// ================== Cesium 初始化 ==================
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyNWMwMzdkMy01ZTYyLTRjNjEtOWZlNy02ZjQ5MGE0M2VhODAiLCJpZCI6Mjg0ODc5LCJpYXQiOjE3NDIxODM3OTd9.8MwRpOLNncG8P_QrV8xB2HzBbQI5yswLyV0EPb-iwCw';

const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    shouldAnimate: false,
});
viewer._cesiumWidget._creditContainer.style.display = "none";

// ================== 图层切换 ==================
// 使用url加载高德地图
const Gaode_Road = new Cesium.UrlTemplateImageryProvider({
    url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
});
viewer.imageryLayers.addImageryProvider(Gaode_Road);

export { viewer };