// mapMaker.js
import { viewer } from './cesiumInit.js';

document.getElementById('captureMap').addEventListener('click', function () {
    try {
        // 获取Cesium渲染的canvas
        const cesiumCanvas = viewer.scene.canvas;
        // 触发一次渲染，确保画面最新
        viewer.render();
        // 转为图片
        const image = cesiumCanvas.toDataURL('image/png');
        // 下载
        const link = document.createElement('a');
        link.download = '浙里食光地图_' + new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + '.png';
        link.href = image;
        link.click();
        alert('地图截图已保存！（仅地图内容）');
    } catch (error) {
        alert('截图失败，请重试！\n错误信息：' + error.message);
    }
});