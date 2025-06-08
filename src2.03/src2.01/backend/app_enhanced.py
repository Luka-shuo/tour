import os
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify
from flask import make_response
from flask_cors import CORS
import requests
from sentence_transformers import SentenceTransformer
import faiss
import time
import pickle
import jieba
print("程序启动...")

# 设置Deepseek API密钥
DEEPSEEK_API_KEY = "sk-c975882172734615b61be96e530aacd6"
# 定义保存文件的路径
VECTOR_DB_PATH = 'src2.01/backend/vector_db_enhanced.faiss'
RESTAURANT_DATA_PATH = 'src2.01/backend/restaurant_data_enhanced.pkl'
app = Flask(__name__)
CORS(app)  # 启用CORS支持

print("正在加载文本向量模型，这可能需要几分钟时间...")
print("如果是第一次运行，需要下载模型文件（约1GB），请确保网络连接正常...")
# 全局变量
EMBEDDING_MODEL = SentenceTransformer('shibing624/text2vec-base-chinese')
print("文本向量模型加载完成！")

INDEX = None
RESTAURANT_DF = None
TOP_K = 50  # 检索最相似的5个结果

# 餐厅类型关键词及其相关词
CUISINE_TYPES = {
    '川菜': ['川菜', '四川菜', '川味', '川式', '成都菜'],
    '粤菜': ['粤菜', '广东菜', '广式', '潮州菜'],
    '杭帮菜': ['杭帮菜', '杭州菜', '浙菜', '江浙菜'],
    '湘菜': ['湘菜', '湖南菜', '湖南味道'],
    '日料': ['日料', '日本料理', '寿司', '刺身', '居酒屋'],
    '韩料': ['韩料', '韩国料理', '韩式', '韩国烤肉'],
    '西餐': ['西餐', '意大利菜', '法国菜', '西式', '牛排', '披萨'],
    '火锅': ['火锅', '涮锅', '麻辣烫', '串串香'],
    '小吃': ['小吃', '特色小吃', '街边小吃', '小吃店'],
    '面馆': ['面馆', '面店', '面条', '拉面', '面食']
}

def save_vector_db():
    """保存向量数据库和餐厅数据到本地文件"""
    try:
        print("\n正在保存向量数据库...")
        # 保存FAISS索引
        faiss.write_index(INDEX, VECTOR_DB_PATH)
        
        # 保存餐厅数据
        with open(RESTAURANT_DATA_PATH, 'wb') as f:
            pickle.dump(RESTAURANT_DF, f)
        
        print("✨ 数据保存完成！")
    except Exception as e:
        print(f"❌ 保存数据失败: {e}")
        raise

def load_vector_db():
    """从本地文件加载向量数据库和餐厅数据"""
    global INDEX, RESTAURANT_DF
    
    try:
        print("\n正在从本地加载数据...")
        # 加载FAISS索引
        INDEX = faiss.read_index(VECTOR_DB_PATH)
        
        # 加载餐厅数据
        with open(RESTAURANT_DATA_PATH, 'rb') as f:
            RESTAURANT_DF = pickle.load(f)
        
        print("✨ 数据加载完成！")
        print(f"已加载 {len(RESTAURANT_DF)} 条餐厅数据")
        return True
    except FileNotFoundError:
        print("未找到本地数据文件，需要重新初始化数据库")
        return False
    except Exception as e:
        print(f"❌ 加载数据失败: {e}")
        return False

def get_cuisine_type(text):
    """识别文本中的餐厅类型"""
    # 对文本进行分词
    words = jieba.lcut(text)
    
    # 遍历所有菜系类型及其相关词
    for main_type, related_terms in CUISINE_TYPES.items():
        # 检查文本中是否包含任何相关词
        if any(term in text for term in related_terms):
            return main_type
    return None

def calculate_type_similarity(query_type, restaurant_type):
    """计算两个餐厅类型之间的相似度"""
    if not query_type or not restaurant_type:
        return 0.0
    
    # 如果完全匹配
    if query_type in restaurant_type:
        return 1.0
    
    # 如果餐厅类型包含查询类型的相关词
    query_related_terms = CUISINE_TYPES.get(query_type, [])
    for term in query_related_terms:
        if term in restaurant_type:
            return 0.8
    
    return 0.0

def init_vector_db():
    global RESTAURANT_DF, INDEX
    
    try:
        # 尝试从本地加载数据
        if load_vector_db():
            return
        
        print("\n开始初始化向量数据库...")
        print("1. 正在读取Excel文件...")
        start_time = time.time()
        # 加载原始数据
        RESTAURANT_DF = pd.read_excel('src2.01/backend/杭州餐饮POI.xlsx')
        print(f"Excel文件读取完成！用时：{time.time() - start_time:.2f}秒")
        
        print("2. 正在处理数据列...")
        # 提取需要的列并重命名
        RESTAURANT_DF = RESTAURANT_DF[['name', 'address', 'adname', 'type', 'business_area', 'tel']].copy()
        RESTAURANT_DF.columns = ['店名', '地址', '区县名称', '类型', '商圈', '电话']
        print(f"共处理 {len(RESTAURANT_DF)} 条餐厅数据")
        
        print("3. 正在生成文本描述...")
        # 生成文本描述用于嵌入，加强类型信息的权重
        texts = RESTAURANT_DF.apply(
            lambda row: f"{row['店名']}，位于{row['区县名称']}，地址：{row['地址']}，" \
                      f"类型：{row['类型']} {row['类型']}，" \
                      f"商圈：{row['商圈'] if pd.notna(row['商圈']) else '未知'}，" \
                      f"电话：{row['电话'] if pd.notna(row['电话']) else '暂无'}",
            axis=1
        ).tolist()
        
        print("4. 正在生成文本向量，这可能需要几分钟...")
        start_time = time.time()
        # 生成嵌入向量
        batch_size = 32  # 设置批处理大小
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = EMBEDDING_MODEL.encode(batch, normalize_embeddings=True)
            embeddings.append(batch_embeddings)
            if (i + batch_size) % 320 == 0:  # 每处理320条数据显示一次进度
                print(f"已处理 {i + batch_size}/{len(texts)} 条数据...")
        
        embeddings = np.vstack(embeddings)
        print(f"文本向量生成完成！用时：{time.time() - start_time:.2f}秒")
        
        print("5. 正在创建向量索引...")
        # 创建FAISS索引
        INDEX = faiss.IndexFlatIP(embeddings.shape[1])
        INDEX.add(embeddings)
        # 保存数据到本地
        save_vector_db()
        
        print("\n向量数据库初始化完成！✨")
        print("系统已准备就绪，可以开始处理查询请求...")
        print(f"Flask服务运行在 http://127.0.0.1:5000")
    except Exception as e:
        print(f"\n❌ 初始化向量数据库失败: {e}")
        raise

def get_similar_restaurants(query, top_k=5):
    """基于用户查询获取最相似的餐厅"""
    print(f"\n处理新的查询请求: {query}")
    
    # 识别查询中的餐厅类型
    query_type = get_cuisine_type(query)
    if query_type:
        print(f"识别到餐厅类型: {query_type}")
    
    # 生成查询向量
    query_vector = EMBEDDING_MODEL.encode([query], normalize_embeddings=True)
    
    # 获取初始的相似度排序结果
    distances, indices = INDEX.search(query_vector, min(top_k * 5, len(RESTAURANT_DF)))  # 获取更多候选结果
    
    # 整理候选餐厅列表
    candidates = []
    for i, idx in enumerate(indices[0]):
        restaurant = RESTAURANT_DF.iloc[idx]
        # 计算类型相似度分数
        type_similarity = calculate_type_similarity(query_type, restaurant['类型'])
        
        # 计算综合得分
        # 将向量相似度归一化到[0,1]范围
        normalized_similarity = (float(distances[0][i]) + 1) / 2
        # 综合得分 = 0.6 * 类型相似度 + 0.4 * 向量相似度
        combined_score = 0.6 * type_similarity + 0.4 * normalized_similarity if query_type else normalized_similarity
        
        candidates.append({
            '店名': restaurant['店名'],
            '地址': restaurant['地址'],
            '区县名称': restaurant['区县名称'],
            '类型': restaurant['类型'],
            '商圈': restaurant['商圈'] if pd.notna(restaurant['商圈']) else '未知',
            '电话': restaurant['电话'] if pd.notna(restaurant['电话']) else '暂无',
            'combined_score': combined_score
        })
    
    # 根据综合得分排序
    candidates.sort(key=lambda x: x['combined_score'], reverse=True)
    
    # 返回top_k个结果
    similar_restaurants = candidates[:top_k]
    print(f"找到 {len(similar_restaurants)} 个相似餐厅")
    
    # 移除排序用的临时字段
    for restaurant in similar_restaurants:
        del restaurant['combined_score']
    
    return similar_restaurants

@app.route('/')
def home():
    return jsonify({
        'status': 'ok',
        'message': '服务正在运行',
        'usage': {
            'endpoint': '/get_recommendation',
            'method': 'POST',
            'body': {
                'query': '查询文本，例如：我想在西湖边吃杭帮菜'
            }
        }
    })

@app.route('/get_recommendation', methods=['GET', 'POST'])
def get_recommendation():
    try:
        # 获取查询参数
        if request.method == 'GET':
            # 处理GET请求
            return jsonify({
                'error': '请使用POST方法',
                'usage': {
                    'method': 'POST',
                    'content-type': 'application/json',
                    'body': {
                        'query': '查询文本，例如：我想在西湖边吃杭帮菜'
                    }
                }
            }), 400
            
        # 处理POST请求
        if not request.is_json:
            return jsonify({
                'error': '请求格式错误',
                'message': '请使用JSON格式发送请求',
                'example': {
                    'query': '查询文本，例如：我想在西湖边吃杭帮菜'
                }
            }), 400
            
        user_query = request.json.get('query', '')
        if not user_query:
            return jsonify({
                'error': '查询内容不能为空',
                'example': {
                    'query': '我想在西湖边吃杭帮菜'
                }
            }), 400    
        print(f"\n收到用户查询: {user_query}")
        # 获取相似餐厅
        similar_restaurants = get_similar_restaurants(user_query, TOP_K)
        
        print("正在生成推荐内容...")
        # 构建发送给Deepseek的提示词
        restaurants_context = "\n".join([
            f"餐厅：{r['店名']} | 类型：{r['类型']} | 区县：{r['区县名称']} | 商圈：{r['商圈']} | 地址：{r['地址']} | 电话：{r['电话']}"
            for i, r in enumerate(similar_restaurants)
        ])
        
        prompt = f"""基于以下餐厅数据，针对用户需求"{user_query}"推荐最合适的餐厅：

{restaurants_context}

请简要分析并推荐最合适的餐厅，包含：餐厅名称、位置信息、类型和推荐理由。"""

        # Deepseek API配置
        headers = {
            'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'deepseek-chat',
            'messages': [
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.3,  # 降低温度以加快响应
            'max_tokens': 400    # 限制输出长度
        }

        print("正在调用Deepseek API生成推荐...")
        response = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers=headers,
            json=data,
            timeout=60
        )
        print(f"Deepseek API响应状态码: {response.status_code}")
        
        response.raise_for_status()
        recommendation = response.json()['choices'][0]['message']['content']
        print("推荐内容生成完成！")
        
        return jsonify({
            'status': 'success',
            'recommendation': recommendation,
            'similar_restaurants': similar_restaurants
        })
        
    except requests.exceptions.RequestException as e:
        print(f"❌ API请求异常: {str(e)}")
        return jsonify({
            'error': 'API请求失败',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"❌ 未知异常: {str(e)}")
        return jsonify({
            'error': '处理请求失败',
            'details': str(e)
        }), 500

print("\n正在启动系统...")
# 应用启动时初始化向量数据库
init_vector_db()
if __name__ == '__main__':
    app.run(debug=True) 