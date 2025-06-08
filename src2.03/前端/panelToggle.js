// panelToggle.js
// ================== 显示/隐藏面板 ==================
function XianShi(id) {
    let a = document.getElementById(id);
    if (!a) return;
    a.style.display = (a.style.display === "none" ? "block" : "none");
}

// 按钮控制显示/隐藏
document.getElementById('routeAnalysis').onclick = function () {
    let panel = document.getElementById('controlPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('userCollection').onclick = function () {
    let panel = document.getElementById('MapMark');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 将路线点分析的功能移到餐饮信息按钮
document.getElementById('foodInfo').onclick = function () {
    let panel = document.getElementById('customInfoBox');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 聚类显示按钮控制 Echarts 图表模块的显示与隐藏
document.getElementById('clusterDisplay').onclick = function () {
    let panel = document.getElementById('ECharts-box');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 地图制作面板显示/隐藏
document.getElementById('mapMaker').onclick = function () {
    let panel = document.getElementById('mapMakerPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

document.getElementById('weather-hangzhou').onclick = function () {
    let panel = document.getElementById('controls-panel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 路线点分析面板显示/隐藏
document.getElementById('bufferAnalysis').onclick = function () {
    let panel = document.getElementById('bufferAnalysisPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

document.getElementById('SpatialAnalysis').onclick = function () {
    let panel = document.getElementById('editBox');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};