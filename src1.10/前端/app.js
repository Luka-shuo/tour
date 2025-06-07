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
 //使用url加载高德地图
        const Gaode_Road = new Cesium.UrlTemplateImageryProvider({
            url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
        });
        viewer.imageryLayers.addImageryProvider(Gaode_Road);
// ================== 商家/路线收藏（前端本地存储） ==================
function saveBookmark(type, name, camera) {
    const key = type === 'shop' ? 'shopBookmarks' : 'routeBookmarks';
    // 直接通过id获取ul
    const ul = document.getElementById(type === 'shop' ? 'shopBookmarkList' : 'routeBookmarkList');
    let bookmarks = JSON.parse(localStorage.getItem(key) || '[]');
    const bookmark = {
        name,
        longitude: Cesium.Math.toDegrees(camera.positionCartographic.longitude),
        latitude: Cesium.Math.toDegrees(camera.positionCartographic.latitude),
        height: camera.positionCartographic.height,
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll
    };
    bookmarks.push(bookmark);
    localStorage.setItem(key, JSON.stringify(bookmarks));
    renderBookmarks(type, bookmarks); // 只传type和bookmarks
}

function renderBookmarks(type, bookmarks) {
    const ul = document.getElementById(type === 'shop' ? 'shopBookmarkList' : 'routeBookmarkList');
    ul.innerHTML = '';
    bookmarks.forEach((b, idx) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '2px 0';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = b.name;
        nameSpan.style.cursor = 'pointer';
        nameSpan.onclick = () => {
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(b.longitude, b.latitude, b.height),
                orientation: { heading: b.heading, pitch: b.pitch, roll: b.roll },
                duration: 2
            });
        };

        const delBtn = document.createElement('button');
        delBtn.textContent = '删除';
        delBtn.className = 'mark-btn';
        delBtn.style.marginLeft = '8px';
        delBtn.onclick = () => {
            bookmarks.splice(idx, 1);
            localStorage.setItem(type === 'shop' ? 'shopBookmarks' : 'routeBookmarks', JSON.stringify(bookmarks));
            renderBookmarks(type, bookmarks);
        };

        li.appendChild(nameSpan);
        li.appendChild(delBtn);
        ul.appendChild(li);
    });
}

// 初始化渲染
window.addEventListener('DOMContentLoaded', () => {
    ['shop', 'route'].forEach(type => {
        const key = type === 'shop' ? 'shopBookmarks' : 'routeBookmarks';
        const bookmarks = JSON.parse(localStorage.getItem(key) || '[]');
        renderBookmarks(type, bookmarks);
    });
});

// 商家收藏
document.getElementById('submitShopBookmark')?.addEventListener('click', function () {
    const input = document.getElementById('shopMarkName');
    const bookmarkName = input.value.trim();
    if (!bookmarkName) {
        alert('请输入商家名称');
        return;
    }
    saveBookmark('shop', bookmarkName, viewer.camera);
    input.value = '';
    alert('商家收藏已保存');
});

// 路线收藏
document.getElementById('submitRouteBookmark')?.addEventListener('click', function () {
    const input = document.getElementById('routeMarkName');
    const bookmarkName = input.value.trim();
    if (!bookmarkName) {
        alert('请输入路线名称');
        return;
    }
    saveBookmark('route', bookmarkName, viewer.camera);
    input.value = '';
    alert('路线收藏已保存');
});

// ================== 显示/隐藏面板 ==================
function XianShi(id) {
    let a = document.getElementById(id);
    if (!a) return;
    a.style.display = (a.style.display === "none" ? "block" : "none");
}
// ================== 路线规划功能 ==================
let routeMode = null;
let startCoord = null;
let endCoord = null;
let startPointEntity = null;
let endPointEntity = null;
let routeEntity = null;

document.getElementById('setStart')?.addEventListener('click', () => { routeMode = 'start'; });
document.getElementById('setEnd')?.addEventListener('click', () => { routeMode = 'end'; });

document.getElementById('confirmRoute')?.addEventListener('click', async () => {
    if (!startCoord || !endCoord) {
        alert("请先选择起点和终点！");
        return;
    }
    const origin = `${startCoord.lon},${startCoord.lat}`;
    const destination = `${endCoord.lon},${endCoord.lat}`;
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/route?origin=${origin}&destination=${destination}`);
        const data = await res.json();
        if (!data.coords) {
            alert("后端返回异常：" + (data.error || "未知错误"));
            return;
        }
        // 删除旧路线
        if (routeEntity) viewer.entities.remove(routeEntity);
        // 添加新路线
        routeEntity = viewer.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(data.coords),
                width: 5,
                material: Cesium.Color.RED,
                clampToGround: true
            }
        });
        viewer.zoomTo(routeEntity);
        // 显示路程信息
        const minutes = Math.round(data.duration / 60);
        const kilometers = (data.distance / 1000).toFixed(2);
        document.getElementById("routeInfo").innerText = `预计用时：${minutes} 分钟，距离：${kilometers} 公里`;
    } catch (error) {
        alert("请求失败：" + error);
        console.error(error);
    }
});

viewer.screenSpaceEventHandler.setInputAction(click => {
    let cartesian = viewer.scene.pickPosition(click.position);
    if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
    }
    if (!cartesian || !routeMode) return;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat);

    if (routeMode === 'start') {
        startCoord = { lon, lat };
        document.getElementById('startInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
        // 删除旧起点
        if (startPointEntity) viewer.entities.remove(startPointEntity);
        startPointEntity = viewer.entities.add({
            position: pos,
            point: { pixelSize: 10, color: Cesium.Color.GREEN },
            label: { text: "起点", font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -20) }
        });
    } else if (routeMode === 'end') {
        endCoord = { lon, lat };
        document.getElementById('endInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
        // 删除旧终点
        if (endPointEntity) viewer.entities.remove(endPointEntity);
        endPointEntity = viewer.entities.add({
            position: pos,
            point: { pixelSize: 10, color: Cesium.Color.BLUE },
            label: { text: "终点", font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -20) }
        });
    }
    routeMode = null;
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ================== 美食POI展示 ==================
const pinBuilder = new Cesium.PinBuilder();
const infoBox = document.getElementById('customInfoBox');
const entityInfoMap = new Map();
let lastSelected = null;

fetch('杭州餐饮POI.json')
  .then(response => response.json())
  .then(data => {
    data.forEach(item => {
      const defaultIcon = pinBuilder.fromText('🍴', Cesium.Color.RED, 32).toDataURL();
      const highlightIcon = pinBuilder.fromText('🍴', Cesium.Color.YELLOW, 40).toDataURL();
      const entity = viewer.entities.add({
        id: Cesium.createGuid(),
        name: item.name,
        position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat),
        billboard: {
          image: defaultIcon,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      entityInfoMap.set(entity.id, { item, defaultIcon, highlightIcon });
    });
    viewer.zoomTo(viewer.entities);
  });

viewer.screenSpaceEventHandler.setInputAction(evt => {
    // 路线选点优先
    if (routeMode) {
        let cartesian = viewer.scene.pickPosition(evt.position);
        if (!cartesian) {
            cartesian = viewer.camera.pickEllipsoid(evt.position, viewer.scene.globe.ellipsoid);
        }
        if (!cartesian) return;
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const pos = Cesium.Cartesian3.fromDegrees(lon, lat);

        if (routeMode === 'start') {
            startCoord = { lon, lat };
            document.getElementById('startInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
            if (startPointEntity) viewer.entities.remove(startPointEntity);
            startPointEntity = viewer.entities.add({
                position: pos,
                point: { pixelSize: 10, color: Cesium.Color.GREEN },
                label: { text: "起点", font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -20) }
            });
        } else if (routeMode === 'end') {
            endCoord = { lon, lat };
            document.getElementById('endInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
            if (endPointEntity) viewer.entities.remove(endPointEntity);
            endPointEntity = viewer.entities.add({
                position: pos,
                point: { pixelSize: 10, color: Cesium.Color.BLUE },
                label: { text: "终点", font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -20) }
            });
        }
        routeMode = null;
        return; // 跃线选点时不处理POI
    }

    // POI点击逻辑
    const picked = viewer.scene.pick(evt.position);
    if (lastSelected) {
        const info = entityInfoMap.get(lastSelected.id);
        lastSelected.billboard.image = info.defaultIcon;
        lastSelected = null;
    }
    if (Cesium.defined(picked) && picked.id) {
        const data = entityInfoMap.get(picked.id.id);
        if (data) {
            picked.id.billboard.image = data.highlightIcon;
            lastSelected = picked.id;
            const categories = data.item.type
                ? data.item.type.split(';').filter(Boolean).join(' / ')
                : '未知';
            const region = data.item.adname || '未知';
            infoBox.innerHTML = `
                <h3>${data.item.name}</h3>
                <p><strong>类别：</strong>${categories}</p>
                <p><strong>区域：</strong>${region}</p>
                <p><strong>地址：</strong>${data.item.address}</p>
                <p><strong>电话：</strong>${data.item.tel && data.item.tel.length ? data.item.tel : '暂无'}</p>
            `;
            infoBox.style.display = 'block';
            return;
        }
    }
    infoBox.style.display = 'none';
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// 信息面板拖拽
(function() {
  let isDragging = false;
  let startX, startY;
  infoBox?.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.clientX - infoBox.offsetLeft;
    startY = e.clientY - infoBox.offsetTop;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) {
      infoBox.style.left = `${e.clientX - startX}px`;
      infoBox.style.top = `${e.clientY - startY}px`;
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
})();
// ================== 视角控制（如有按钮） ==================
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

// 按钮控制显示/隐藏
document.getElementById('routeAnalysis').onclick = function() {
    let panel = document.getElementById('controlPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('userCollection').onclick = function() {
    let panel = document.getElementById('MapMark');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 将路线点分析的功能移到餐饮信息按钮
document.getElementById('foodInfo').onclick = function() {
    let panel = document.getElementById('customInfoBox');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 聚类显示按钮暂时不添加功能
document.getElementById('clusterDisplay').onclick = function() {
    // 暂时不添加功能
};

// ================== 地图制作功能 ==================
document.getElementById('mapMaker').onclick = function() {
    let panel = document.getElementById('mapMakerPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

document.getElementById('captureMap').addEventListener('click', function() {
    try {
        // 获取Cesium渲染的canvas
        const cesiumCanvas = viewer.scene.canvas;
        // 触发一次渲染，确保画面最新
        viewer.render();
        // 转为图片
        const image = cesiumCanvas.toDataURL('image/png');
        // 下载
        const link = document.createElement('a');
        link.download = '浙里食光地图_' + new Date().toISOString().slice(0,19).replace(/[:]/g, '-') + '.png';
        link.href = image;
        link.click();
        alert('地图截图已保存！（仅地图内容）');
    } catch (error) {
        alert('截图失败，请重试！\n错误信息：' + error.message);
    }
});

// ================== 路线点分析功能 ==================
let bufferEntity = null;
let originalPoiEntities = new Map();
let isAnalyzing = false;

// 显示/隐藏路线点分析面板
document.getElementById('bufferAnalysis').onclick = function() {
    let panel = document.getElementById('bufferAnalysisPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};

// 开始分析
document.getElementById('startAnalysis').onclick = async function() {
    if (!routeEntity) {
        alert('请先进行路线分析！');
        return;
    }
    
    if (isAnalyzing) {
        alert('分析正在进行中！');
        return;
    }
    
    isAnalyzing = true;
    
    try {
        // 获取路线坐标
        const routePositions = routeEntity.polyline.positions.getValue();
        const routeCoords = [];
        for (let i = 0; i < routePositions.length; i++) {
            const cartographic = Cesium.Cartographic.fromCartesian(routePositions[i]);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            routeCoords.push(`${lon},${lat}`);
        }
        
        // 获取起点和终点坐标
        const startCartographic = Cesium.Cartographic.fromCartesian(startPointEntity.position.getValue());
        const endCartographic = Cesium.Cartographic.fromCartesian(endPointEntity.position.getValue());
        const startPoint = `${Cesium.Math.toDegrees(startCartographic.longitude)},${Cesium.Math.toDegrees(startCartographic.latitude)}`;
        const endPoint = `${Cesium.Math.toDegrees(endCartographic.longitude)},${Cesium.Math.toDegrees(endCartographic.latitude)}`;
        
        // 调用后端API进行缓冲区分析
        const response = await fetch(`http://127.0.0.1:8000/api/buffer-analysis?route_coords=${routeCoords.join(';')}&start_point=${startPoint}&end_point=${endPoint}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 显示缓冲区
        if (bufferEntity) {
            viewer.entities.remove(bufferEntity);
        }
        
        // 处理缓冲区几何数据
        const coordinates = data.buffer_geometry.coordinates[0];
        const bufferPositions = [];
        for (const coord of coordinates) {
            bufferPositions.push(coord[0], coord[1], 0);
        }
        
        bufferEntity = viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(
                    Cesium.Cartesian3.fromDegreesArrayHeights(bufferPositions)
                ),
                material: Cesium.Color.ORANGE.withAlpha(0.3),
                outline: true,
                outlineColor: Cesium.Color.ORANGE
            }
        });
        
        // 处理POI点
        const poiInfoPanel = document.getElementById('poiInfoPanel');
        poiInfoPanel.innerHTML = '';
        
        // 保存原始POI实体状态
        originalPoiEntities.clear();
        viewer.entities.values.forEach(entity => {
            if (entity.billboard && entity.billboard.image) {
                originalPoiEntities.set(entity.id, {
                    visible: entity.show,
                    image: entity.billboard.image.getValue()
                });
            }
        });
        
        // 创建缓冲区内的POI地址集合
        const bufferPoiAddresses = new Set(data.buffer_pois.map(poi => poi.address));
        
        // 高亮显示缓冲区内的POI
        viewer.entities.values.forEach(entity => {
            if (entity.billboard && entity.billboard.image) {
                const entityInfo = entityInfoMap.get(entity.id);
                if (entityInfo && bufferPoiAddresses.has(entityInfo.item.address)) {
                    // 在缓冲区内的点
                    entity.show = true;
                    entity.billboard.image = pinBuilder.fromText('🍴', Cesium.Color.YELLOW, 40).toDataURL();
                } else {
                    // 不在缓冲区内的点
                    entity.show = false;
                }
            }
        });
        
        // 添加POI信息到面板
        data.buffer_pois.forEach(poi => {
            const poiItem = document.createElement('div');
            poiItem.className = 'poi-item';
            poiItem.innerHTML = `
                <h4>${poi.name}</h4>
                <p><strong>类型：</strong>${poi.type || '未知'}</p>
                <p><strong>地址：</strong>${poi.address || '未知'}</p>
                <p><strong>电话：</strong>${poi.tel || '未知'}</p>
            `;
            poiInfoPanel.appendChild(poiItem);
        });
        
        // 显示POI信息面板
        poiInfoPanel.style.display = 'block';
        
    } catch (error) {
        alert('分析失败：' + error.message);
        isAnalyzing = false;
    }
};

// 结束分析
document.getElementById('endAnalysis').onclick = function() {
    if (!isAnalyzing) {
        return;
    }
    
    // 移除缓冲区
    if (bufferEntity) {
        viewer.entities.remove(bufferEntity);
        bufferEntity = null;
    }
    
    // 恢复POI显示状态
    originalPoiEntities.forEach((state, id) => {
        const entity = viewer.entities.getById(id);
        if (entity) {
            entity.show = state.visible;
            entity.billboard.image = state.image;
        }
    });
    
    // 隐藏POI信息面板
    document.getElementById('poiInfoPanel').style.display = 'none';
    
    isAnalyzing = false;
};