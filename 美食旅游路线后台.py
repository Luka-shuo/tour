import requests
import json
from math import radians, cos, sin, asin, sqrt, exp, e
from jenkspy import jenks_breaks
from flask import Flask, request, jsonify
from flask_cors import CORS

class DB():
    def __init__(self):
        self.WECHAT_URL = 'https://api.weixin.qq.com/'
        self.APP_ID = 'wx502dbf2970e2f154'  # 小程序id
        self.APP_SECRET = '215320277b665ab8481e8b147902f52d'  # 小程序密钥
        self.ENV = 'cloud1-2g1jkwnsccbab079'  # 云环境ID

    # 获取小程序token
    def get_access_token(self):
        url = '{0}cgi-bin/token?grant_type=client_credential&appid={1}&secret={2}'.format(self.WECHAT_URL, self.APP_ID,
                                                                                          self.APP_SECRET)
        response = requests.get(url)
        result = response.json()

        return result['access_token']

    def query_data(self, accessToken, query):

        url = '{0}tcb/databasequery?access_token={1}'.format(self.WECHAT_URL, accessToken)

        data = {
            "env": self.ENV,
            "query": query
        }
        response = requests.post(url, data = json.dumps(data))
        temData = response.json()['data']

        return temData
# 后端服务器启动
app = Flask(__name__)
CORS(app, resources=r'/*')


@app.route('/foodselect')
def foodSelect():
    flag = int(request.args.get('flag'))
    param = request.args.get('param')
    # flag = 0
    # 选择具体的数据库
    # db = psycopg2.connect(database=database, password=password, user=user)
    # cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    db = DB()
    access_token = db.get_access_token()
    temList = []
    res = []
    # flag为0为查找所有菜并按评分排序,flag为1进行菜名查询,flag为2进行菜口味查询,flag为3进行菜主食查询
    if flag == 0:
        # cursor.execute("select * from nanchangfood")
        # data = cursor.fetchall()
        query = f"db.collection('nanchangfood').limit(950).get()"
        temData = db.query_data(access_token, query)
    elif flag == 1:
        # cursor.execute(f"select * from nanchangfood where foodname like '%{param}%'")
        # data = cursor.fetchall()
        query = f"db.collection('nanchangfood').limit(950).where({{foodname:db.RegExp({{regexp:'{param}',options:'i'}})}}).get()"
        temData = db.query_data(access_token, query)
    elif flag == 2:
        # cursor.execute(f"select * from nanchangfood where taste = '{param}'")
        # data = cursor.fetchall()
        query = f"db.collection('nanchangfood').limit(950).where({{taste:db.RegExp({{regexp:'{param}',options:'i'}})}}).get()"
        temData = db.query_data(access_token, query)
    elif flag == 3:
        # cursor.execute(f"select * from nanchangfood where mainfood like '%{param}%'")
        # data = cursor.fetchall()
        query = f"db.collection('nanchangfood').limit(950).where({{mainfood:db.RegExp({{regexp:'{param}',options:'i'}})}}).get()"
        temData = db.query_data(access_token, query)
    else:
        return '请输入正确参数'
    for i in temData:
        temList.append(json.loads(i))
    data = sorted(temList, key=lambda x: x['commend'], reverse=True)
    # 按评分排序
    # temData = [dict(row) for row in data]
    # print(temData)
    # data = sorted(temData, key=lambda x: x['commend'],reverse=True)
    # data = sorted(data, key=lambda d: d[4], reverse=True)
    for i in data:
        tem = {}
        tem['foodname'] = i['foodname']
        tem['imgurl'] = i['foodimgs']
        tem['foodmain'] = ' '.join(i['mainfood'].split('<>'))
        tem['commend'] = i['commend']
        tem['taste'] = i['taste']
        tem['detail'] = i['detail']
        tem['shopfood'] = i['shopname']
        res.append(tem)
    return jsonify(res)

@app.route('/scenename')
def sceneSelectStore():
    # 获得前端请求的参数
    # 参数依次是限定距离，价格最大值，店家经度，店家纬度（此处以沙县小吃为例），最终返回个数，距离权重，花费权重，评分权重，是否为星级点
    # distance, min, max, spotlon1, spotlat1, count, disrate, pricerate, scorerate, salesrate
    # selectStore(1.5, 20, 80, 115.884102, 28.679151, 5, 0.5, 0.2, 0.3)
    distance = float(request.args.get('distance'))
    max = float(request.args.get('max'))
    spotlon1 = float(request.args.get('spotlon1'))
    spotlat1 = float(request.args.get('spotlat1'))
    count = int(request.args.get('count'))
    disrate = float(request.args.get('disrate'))
    pricerate = float(request.args.get('pricerate'))
    scorerate = float(request.args.get('scorerate'))
    grade = int(request.args.get('grade'))
    if distance is not None and max is not None and spotlat1 \
            is not None and spotlon1 is not None and count is not None and disrate \
            is not None and pricerate is not None and scorerate is not None == True:
        return "请输入参数"
    # 选择具体的数据库
    # db = psycopg2.connect(database=database, password=password, user=user)
    # cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    db = DB()
    access_token = db.get_access_token()
    temList = []
    # 如果用户只想推荐星级点
    if grade == 1:
        query = f"db.collection('scenenames').limit(950).where({{grade:_.neq(0)}}).get()"  # 相当于是sql语句
        temData = db.query_data(access_token, query)
        for i in temData:
            temList.append(json.loads(i))
        # cursor.execute("select * from scenenames where grade <> '0'")
        # data = cursor.fetchall()
    # 选择数据库里的具体表,并得到数据
    else:
        query = f"db.collection('scenenames').limit(950).get()"  # 相当于是sql语句
        temData = db.query_data(access_token, query)
        for i in temData:
            temList.append(json.loads(i))
    # temData = [dict(row) for row in data]
    # print(temData)
    data = sorted(temList, key=lambda x: x['score'], reverse=True)
    # 滕王阁位置
    # spotlon1, spotlat1 = (115.884102, 28.679151)
    temp = {}  # 存储最后的结果字典
    dis = []  # 存储距离分数的数组
    price = []  # 存储价格或星级分数的数组
    score = []  # 存储得分分数的数组
    jishu = 0
    # 如果用户只想推荐星级点
    if grade == 1:
        for i in data:
            # 根据经纬度计算两地的距离
            res = geodistance(spotlon1, spotlat1, i['longitude'], i['latitude'])

            # 判断价格是否超限
            if float(i['price']) > max:
                jishu = jishu + 1
            elif float(i['price']) <= max:
                # 只有当价格小于给定的时，才考虑后续参数，在temp中为要考虑的对象创建一个空间
                temp[i['pointname']] = []
                # 为距离设定的算法函数
                disValue = disMethod(res, distance)
                # 为星级设定的算法
                gradeValue = scoreMethod(float(i['grade']))
                # 为综合评分设定的函数
                scoreValue = scoreMethod(float(i['score']))
                price.append(gradeValue)
                dis.append(disValue)
                score.append(scoreValue)
            # 为得分重新赋值
            if len(dis) == len(data) - jishu:
                print("price", price)
                newdis = MaxMinNormalization(dis)
                newprice = MaxMinNormalization(price)
                newscore = MaxMinNormalization(score)
    else:
        for i in data:
            # 根据经纬度计算两地的距离
            res = geodistance(spotlon1, spotlat1, i['longitude'], i['latitude'])
            # 判断两地距离是否超过限值
            if res > distance:
                jishu = jishu + 1
            elif res <= distance:
                # 只有当距离小于给定的距离时，才考虑后续参数，在temp中为要考虑的对象创建一个空间
                temp[i['pointname']] = []
                # 为距离设定的算法函数
                disValue = disMethod(res, distance)
                # 为价格设定的算法,设用户选择区间为150~200
                priceValue = priceMethod(int(i['price']), 0, max)
                # 为综合评分设定的函数
                scoreValue = scoreMethod(float(i['score']))
                price.append(priceValue)
                dis.append(disValue)
                score.append(scoreValue)
            # 为得分重新赋值
            if len(dis) == len(data) - jishu:
                print("price", price)
                newdis = MaxMinNormalization(dis)
                newprice = MaxMinNormalization(price)
                newscore = MaxMinNormalization(score)
                # newfood = MaxMinNormalization(food)
    jishu = 0
    for i in temp.keys():
        temp[i].append(newdis[jishu])
        temp[i].append(newprice[jishu])
        temp[i].append(newscore[jishu])
        # temp[i].append(newfood[jishu])
        jishu = jishu + 1
    # 根据权重计算最终得分
    print("def", temp)
    statResponse = weigh(temp, disrate, pricerate, scorerate, count)
    print("选景点", statResponse)
    return jsonify(statResponse)


@app.route('/shopname')
def shopSelectStore():
    # 获得前端请求的参数
    # 参数依次是限定距离，价格最小值，价格最大值，景点经度，景点纬度（此处以滕王阁为例），最终返回个数,距离权重，价格权重，评分选择
    # distance, min, max, spotlon1, spotlat1, count, disrate, pricerate, scorerate, salesrate
    # selectStore(1.5, 20, 80, 115.884102, 28.679151, 5, 0.5, 0.2, 0.3)
    distance = float(request.args.get('distance'))
    min = float(request.args.get('min'))
    max = float(request.args.get('max'))
    spotlon1 = float(request.args.get('spotlon1'))
    spotlat1 = float(request.args.get('spotlat1'))
    count = int(request.args.get('count'))
    disrate = float(request.args.get('disrate'))
    pricerate = float(request.args.get('pricerate'))
    scorerate = float(request.args.get('scorerate'))
    if distance is not None and min is not None and max is not None and spotlat1 \
            is not None and spotlon1 is not None and count is not None and disrate \
            is not None and pricerate is not None and scorerate is not None == True:
        return "请输入参数"
    # 选择具体的数据库
    # db = psycopg2.connect(database=database, password=password, user=user)
    # cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # 选择数据库里的具体表,并得到数据
    # cursor.execute("select * from shopnames ")
    # data = cursor.fetchall()
    # temData = [dict(row) for row in data]
    db = DB()
    access_token = db.get_access_token()
    query = f"db.collection('shopnames').limit(950).get()"  # 相当于是sql语句
    temData = db.query_data(access_token, query)
    temList = []
    for i in temData:
        temList.append(json.loads(i))
    query = f"db.collection('shopnames').skip(951).limit(950).get()"
    temData = db.query_data(access_token, query)
    for i in temData:
        temList.append(json.loads(i))
    data = sorted(temList, key=lambda x: x['score'], reverse=True)
    # print('数据',len(data))
    # 滕王阁位置
    # spotlon1, spotlat1 = (115.884102, 28.679151)
    temp = {}  # 存储最后的结果字典
    dis = []  # 存储距离分数的数组
    price = []  # 存储价格分数的数组
    score = []  # 存储得分分数的数组
    food = []  # 存储是否有某个菜分数的数组
    jishu = 0
    for i in data:
        # 根据经纬度计算两地的距离
        res = geodistance(spotlon1, spotlat1, i['longitude'], i['latitude'])
        # print("距离",res)
        # 判断两地距离是否超过限值
        if res > distance:
            jishu = jishu + 1
        elif res <= distance:
            # 只有当距离小于给定的距离时，才考虑后续参数，在temp中为要考虑的对象创建一个空间
            temp[i['shopname']] = []
            # 为距离设定的算法函数
            disValue = disMethod(res, distance)
            # 为价格设定的算法,设用户选择区间为150~200
            priceValue = priceMethod(int(i['price']), min, max)
            # 为综合评分设定的函数
            scoreValue = scoreMethod(float(i['score']))
            # 为是否有菜品设定的算法
            # foodlist = i[4].split('<>')
            # # 先默认店家没有该菜，得分为0
            # foodValue = foodMethod(foodlist, foodname)
            price.append(priceValue)
            dis.append(disValue)
            score.append(scoreValue)
            # food.append(foodValue)
        # 为得分重新赋值
        if len(dis) == len(data) - jishu:
            print("eff",dis)
            newdis = MaxMinNormalization(dis)
            newprice = MaxMinNormalization(price)
            newscore = MaxMinNormalization(score)
            # newfood = MaxMinNormalization(food)
        # 为web端手动调节缓冲区大小准备
        # if res > 400:
        #     disValue = 0
        # else:
        #     disValue = 1/exp(res
    jishu = 0
    for i in temp.keys():
        temp[i].append(newdis[jishu])
        temp[i].append(newprice[jishu])
        temp[i].append(newscore[jishu])
        # temp[i].append(newfood[jishu])
        jishu = jishu + 1
    # 根据权重计算最终得分
    print(temp)
    statResponse = weigh(temp, disrate, pricerate, scorerate, count)
    print("选店家", statResponse)
    return jsonify(statResponse)


# 根据经纬度计算两点的距离
def geodistance(lng1, lat1, lng2, lat2):
    # lng1, lat1, lng2, lat2 = (120.12802999999997, 30.28708, 115.86572000000001, 28.7427)
    lng1, lat1, lng2, lat2 = map(radians, [float(lng1), float(lat1), float(lng2), float(lat2)])  # 经纬度转换成弧度
    dlon = lng2 - lng1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    distance = 2 * asin(sqrt(a)) * 6371 * 1000  # 地球平均半径，6371km
    # 返回距离以km为单位
    distance = round(distance / 1000, 3)
    return distance


# 对数据进行归一化操作后，在用自然断点法重新赋值
def MaxMinNormalization(unit):
    newValue = []
    tempMax = max(unit)
    tempMin = min(unit)
    # 价格全一样，分母为0，得分全为2
    if tempMax == tempMin:
        for x in unit:
            x = 2
            newValue.append(x)
        return newValue
    for x in unit:
        x = (x - tempMin) / (tempMax - tempMin)
        newValue.append(x)
    print('newvalue', newValue)
    # 当满足距离的点数为1个到3个时
    if len(newValue) == 3:
        tmp_list = sorted(newValue)
        secondValue = tmp_list[-2]
        for i in range(len(newValue)):
            if newValue[i] < secondValue:
                newValue[i] = 1
            elif newValue[i] == secondValue:
                newValue[i] = 2
            else:
                newValue[i] = 3
        return newValue
    elif len(newValue) == 2:
        if newValue[0] > newValue[1]:
            newValue[0] = 3
            newValue[1] = 1
        else:
            newValue[0] = 1
            newValue[1] = 3
        return newValue
    # 当满足距离点数为1个
    elif len(newValue) == 1:
        newValue[0] = 3
        return newValue
    else:
        # 利用自然断点法分为三类，赋值为1,2,3
        breaks = jenks_breaks(newValue, nb_class=3)
        print("breaks", breaks)
        for i in range(len(newValue)):
            if breaks[0] <= newValue[i] < breaks[1]:
                newValue[i] = 1
            elif breaks[1] <= newValue[i] < breaks[2]:
                newValue[i] = 2
            elif breaks[2] <= newValue[i] <= breaks[3]:
                newValue[i] = 3
        return newValue


# 距离算法函数
def disMethod(res, distance):
    disValue = distance-abs(distance - res)
    return disValue


# 价格算法函数
def priceMethod(res, min, max):
    if res >= max:
        priceValue = e ** -(res - max)
    elif res <= min:
        priceValue = e ** -(min - res)
    else:
        priceValue = 1
    return priceValue


# 得分算法函数
def scoreMethod(res):
    return res


# 菜品算法函数
def foodMethod(foodlist, name):
    foodValue = 0
    for i in foodlist:
        if i == name:
            foodValue = 1
            break
    return foodValue


# 加权叠加函数以计算结果
def weigh(temp, a, b, c, count):
    # 将名字和总分单独存入该字典
    res = {}
    # 最后返回给前端的数据
    statResult = []
    for i in temp.items():
        result = 0
        threshold = [a, b, c]
        for j in range(len(i[1])):
            result = result + i[1][j] * threshold[j]
        res[i[0]] = round(result, 1)
    # 将最终得分最小的放在第一个位置
    cd_sorted = sorted(res.items(), key=lambda d: d[1], reverse=True)
    resTem = cd_sorted[0:count]
    # 将结果分为三个等级
    breaks = round(count / 3)
    if count >= 3:
        for i in range(len(resTem)):
            temdict = {}
            if i + 1 <= breaks:
                tem = list(resTem[i])
                tem.append("好")
            elif breaks * 2 >= i + 1 > breaks:
                tem = list(resTem[i])
                tem.append("中")
            else:
                tem = list(resTem[i])
                tem.append("差")
            temdict['shopname'] = tem[0]
            temdict['grade'] = tem[1]
            temdict['flag'] = tem[2]
            statResult.append(temdict)
    else:
        for i in range(len(resTem)):
            temdict = {}
            tem = list(resTem[i])
            tem.append("好")
            temdict['shopname'] = tem[0]
            temdict['grade'] = tem[1]
            temdict['flag'] = tem[2]
            statResult.append(temdict)
    return statResult


if __name__ == '__main__':
    app.run("0.0.0.0", 6543)
