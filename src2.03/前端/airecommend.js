// AI推荐功能模块
class AIRecommend {
  constructor() {
    this.panel = document.getElementById('aiRecommendPanel');
    this.queryInput = document.getElementById('aiQuery');
    this.resultDiv = document.getElementById('aiResult');
    this.loadingDiv = document.getElementById('aiLoading');
    
    // 检查元素是否存在
    if (!this.panel || !this.queryInput || !this.resultDiv || !this.loadingDiv) {
      console.error('AI推荐功能: 缺少必要的DOM元素');
      return;
    }

    // 绑定事件
    const aiSupportBtn = document.getElementById('aiSupport');
    const getRecommendBtn = document.getElementById('getRecommendation');
    
    if (aiSupportBtn) {
      aiSupportBtn.addEventListener('click', () => this.togglePanel());
    }
    if (getRecommendBtn) {
      getRecommendBtn.addEventListener('click', () => this.getRecommendation());
    }
  }

  // 切换面板显示状态
  togglePanel() {
    this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
  }

  // 获取推荐
  async getRecommendation() {
    const query = this.queryInput.value.trim();
    if (!query) {
      alert('请输入您的需求');
      return;
    }

    this.loadingDiv.style.display = 'block';
    this.resultDiv.innerHTML = '';

    try {
      const response = await fetch('http://127.0.0.1:5000/get_recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // 检查是否加载了marked.js库
      if (typeof marked !== 'undefined') {
          this.resultDiv.innerHTML = marked.parse(data.recommendation || '未获取到推荐内容');
      } else {
          // 回退到纯文本显示
          this.resultDiv.innerHTML = data.recommendation || '未获取到推荐内容';
          console.warn('marked.js未加载，无法渲染Markdown格式');
      }
    } catch (error) {
      console.error('获取推荐失败:', error);
      this.resultDiv.innerHTML = `获取推荐失败: ${error.message}`;
    } finally {
      this.loadingDiv.style.display = 'none';
    }
  }
}

// 初始化AI推荐功能
document.addEventListener('DOMContentLoaded', () => {
  new AIRecommend();
});