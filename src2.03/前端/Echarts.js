let data = [];

let selectedField = null;   // 第一排选中的字段名
let selectedChartType = null;  // 第二排选中的图表类型
let selectedRegion = null;

const fieldButtons = document.querySelectorAll('#field-buttons button');
const chartTypeButtons = document.querySelectorAll('#chartType-buttons button');
const RegionButtons = document.querySelectorAll('#region-buttons button');
const chartDom = document.getElementById('chart');
const myChart = echarts.init(chartDom);

// 更新按钮样式
function updateActive(buttons, activeBtn) {
  buttons.forEach(btn => btn.classList.remove('active'));
  if (activeBtn) activeBtn.classList.add('active');
}

RegionButtons.forEach(btn => {
  btn.disabled = true;
});

// 点击第一排按钮
fieldButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedField = btn.getAttribute('data-field');
    updateActive(fieldButtons, btn);
    tryRenderChart();

    if (selectedField === 'adname') {
      RegionButtons.forEach(btn => {
        btn.disabled = true;
      });
    } else {
      RegionButtons.forEach(btn => {
        btn.disabled = false;
      });
    }
  });
});

// 点击第二排按钮
chartTypeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedChartType = btn.getAttribute('data-chart');
    updateActive(chartTypeButtons, btn);
    tryRenderChart();
  });
});

RegionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedRegion = btn.getAttribute('data-region');
    updateActive(RegionButtons, btn);
    tryRenderChart();
  });
});

// 根据选择生成图表
function tryRenderChart() {
  const myChart = echarts.init(document.getElementById('chart'));

  if (!selectedField || (selectedField == 'adname' && !selectedChartType) || (selectedField != 'adname' && (!selectedChartType || !selectedRegion))) {
    myChart.clear();
    return;
  }

  myChart.clear(); // 清除旧图

  // 筛选区域数据
  let filteredData;

  if (selectedField === 'adname') {
    filteredData = data;
  } else {
    filteredData = selectedRegion === 'all'
      ? data
      : data.filter(item => item.adname === selectedRegion);
  }

  if (filteredData.length === 0) {
    myChart.setOption({ title: { text: '无数据', left: 'center' } });
    return;
  }

  // 统计字段数量
  const counts = {};
  filteredData.forEach(item => {
    const val = item[selectedField] || '未知';
    counts[val] = (counts[val] || 0) + 1;
  });

  const total = filteredData.length;
  const entries = Object.entries(counts);

  if (selectedChartType === 'pie') {
    const pieData = entries.map(([name, value]) => ({
      name,
      value
    }));
    const option = {
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          name: selectedField,
          type: 'pie',
          radius: '50%',
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            formatter: '{b}: {d}%'
          }
        }
      ]
    };
    myChart.setOption(option);
  } else if (selectedChartType === 'bar') {
    const showXAxisLabels = !(selectedField === 'type3');
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          const p = params[0];
          const percent = ((p.data / total) * 100).toFixed(2);
          return `${p.name}: ${p.data} (${percent}%)`;
        }
      },
      xAxis: {
        type: 'category',
        data: entries.map(e => e[0]),
        axisLabel: {
          interval: 0,
          rotate: 30,
          show: showXAxisLabels
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}'
        }
      },
      series: [
        {
          data: entries.map(e => e[1]),
          type: 'bar',
          itemStyle: {
            color: '#5470C6'
          }
        }
      ]
    };
    myChart.setOption(option);
  }
}

// 异步加载本地  杭州餐饮POI.json，初始化 data 数组
fetch('./data.json')
  .then(response => response.json())
  .then(jsonData => {
    data = jsonData;
    console.log('数据加载完成:', data);
  })
  .catch(err => {
    console.error('加载  data.json 失败:', err);
  });

document.getElementById('ECharts-box').style.display = 'none';