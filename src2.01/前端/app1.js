// app.js
import './cesiumInit.js';
import './bookmark.js';
import './panelToggle.js';
import './routeFunctions.js';
import './mapMaker.js';
import './weatherModule.js'; 

// 视角控制（如有按钮）
document.getElementById('flyHomeBtn')?.addEventListener('click', () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(120.1551, 30.2741, 50000.0),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0
        },
        duration: 1
    });
});

// 初始隐藏
document.getElementById('controlPanel').style.display = 'none';
document.getElementById('MapMark').style.display = 'none';
document.getElementById('customInfoBox').style.display = 'none';