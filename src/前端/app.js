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
async function ChangePic(id) {
    viewer.imageryLayers.removeAll();
    viewer.scene.primitives.removeAll();
    switch (id) {
        case 'PicGo':
            viewer.scene.primitives.add(
                await Cesium.Cesium3DTileset.fromIonAssetId(2275207)
            );
            break;
        case 'PicBing':
            viewer.imageryLayers.addImageryProvider(
                await Cesium.IonImageryProvider.fromAssetId(3)
            );
            break;
        case 'PicArcMap':
            viewer.imageryLayers.addImageryProvider(
                new Cesium.WebMapTileServiceImageryProvider({
                    url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/WMTS',
                    layer: 'World_Street_Map',
                    style: 'default',
                    format: 'image/png',
                    tileMatrixSetID: 'GoogleMapsCompatible',
                    maximumLevel: 19,
                    credit: new Cesium.Credit('ArcGIS World Street Map')
                })
            );
            break;
        case 'PicOpen':
            viewer.imageryLayers.addImageryProvider(
                new Cesium.OpenStreetMapImageryProvider({
                    url: "https://tile.openstreetmap.org/"
                })
            );
            break;
        case 'PicGao':
            viewer.imageryLayers.addImageryProvider(
                new Cesium.UrlTemplateImageryProvider({
                    url: "http://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
                })
            );
            break;
        case 'PicNight':
            viewer.imageryLayers.addImageryProvider(
                await Cesium.IonImageryProvider.fromAssetId(3812)
            );
            break;
        case 'PicTian':
            viewer.imageryLayers.addImageryProvider(
                new Cesium.WebMapTileServiceImageryProvider({
                    url: "http://t0.tianditu.gov.cn/cia_w/wmts?tk=你的天地图Token",
                    layer: "cia",
                    style: "default",
                    tileMatrixSetID: "w",
                    format: "tiles",
                    maximumLevel: 18,
                })
            );
            viewer.imageryLayers.addImageryProvider(
                new Cesium.WebMapTileServiceImageryProvider({
                    url: "http://t0.tianditu.gov.cn/img_w/wmts?tk=你的天地图Token",
                    layer: "img",
                    style: "default",
                    tileMatrixSetID: "w",
                    format: "tiles",
                    maximumLevel: 18,
                })
            );
            break;
    }
}

// ================== 商家/路线收藏 ==================
document.getElementById('submitShopBookmark')?.addEventListener('click', function () {
    const input = document.getElementById('shopMarkName');
    const bookmarkName = input.value.trim();
    if (!bookmarkName) {
        alert('请输入商家名称');
        return;
    }
    const camera = viewer.camera;
    const position = camera.positionCartographic;
    const bookmark = {
        name: bookmarkName,
        longitude: Cesium.Math.toDegrees(position.longitude),
        latitude: Cesium.Math.toDegrees(position.latitude),
        height: position.height,
        heading: camera.heading, pitch: camera.pitch, roll: camera.roll
    };
    input.value = '';
    const li = document.createElement('li');
    li.textContent = bookmarkName;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                bookmark.longitude, bookmark.latitude, bookmark.height
            ),
            orientation: {
                heading: bookmark.heading, pitch: bookmark.pitch, roll: bookmark.roll
            },
            duration: 2
        });
    });
    document.getElementById('ShopMarkList')?.appendChild(li);
    axios.post('http://127.0.0.1:8000/save_shop', bookmark)
        .catch(() => alert('商家收藏保存失败'));
});

document.getElementById('submitRouteBookmark')?.addEventListener('click', function () {
    const input = document.getElementById('routeMarkName');
    const bookmarkName = input.value.trim();
    if (!bookmarkName) {
        alert('请输入路线名称');
        return;
    }
    const camera = viewer.camera;
    const position = camera.positionCartographic;
    const bookmark = {
        name: bookmarkName,
        longitude: Cesium.Math.toDegrees(position.longitude),
        latitude: Cesium.Math.toDegrees(position.latitude),
        height: position.height,
        heading: camera.heading, pitch: camera.pitch, roll: camera.roll
    };
    input.value = '';
    const li = document.createElement('li');
    li.textContent = bookmarkName;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                bookmark.longitude, bookmark.latitude, bookmark.height
            ),
            orientation: {
                heading: bookmark.heading, pitch: bookmark.pitch, roll: bookmark.roll
            },
            duration: 2
        });
    });
    document.getElementById('RouteMarkList')?.appendChild(li);
    axios.post('http://127.0.0.1:8000/save_route', bookmark)
        .catch(() => alert('路线收藏保存失败'));
});

// ================== 显示/隐藏面板 ==================
function XianShi(id) {
    let a = document.getElementById(id);
    if (!a) return;
    a.style.display = (a.style.display === "none" ? "block" : "none");
}

// ================== 收藏搜索 ==================
document.getElementById('searchBookmarkBtn')?.addEventListener('click', function () {
    const type = document.getElementById('searchType').value;
    const input = document.getElementById('searchBookmark');
    const name = input.value.trim();
    if (!name) {
        alert('请输入名称');
        return;
    }
    const url = type === 'shop'
        ? `http://127.0.0.1:8000/search_shop?name=${encodeURIComponent(name)}`
        : `http://127.0.0.1:8000/search_route?name=${encodeURIComponent(name)}`;
    axios.get(url)
        .then(res => {
            const data = res.data;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    data.longitude, data.latitude, data.height
                ),
                orientation: {
                    heading: data.heading, pitch: data.pitch, roll: data.roll
                },
                duration: 2
            });
        })
        .catch(() => alert('未找到该收藏'));
});

// ================== 路线规划功能 ==================
let routeMode = null;
let startCoord = null;
let endCoord = null;
let pointsLayer = [];

document.getElementById('setStart')?.addEventListener('click', () => { routeMode = 'start'; });
document.getElementById('setEnd')?.addEventListener('click', () => { routeMode = 'end'; });
document.getElementById('confirmRoute')?.addEventListener('click', () => {
    if (!startCoord || !endCoord) {
        alert("请先选择起点和终点！");
        return;
    }
    const origin = `${startCoord.lon},${startCoord.lat}`;
    const destination = `${endCoord.lon},${endCoord.lat}`;
    fetch(`http://127.0.0.1:8000/api/route?origin=${origin}&destination=${destination}`)
        .then(res => res.json())
        .then(routePoints => {
            viewer.entities.add({
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(routePoints),
                    width: 5,
                    material: Cesium.Color.RED,
                    clampToGround: true
                }
            });
            viewer.zoomTo(viewer.entities);
        });
});

viewer.screenSpaceEventHandler.setInputAction(click => {
    const cartesian = viewer.scene.pickPosition(click.position);
    if (!cartesian || !routeMode) return;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat);
    if (routeMode === 'start') {
        startCoord = { lon, lat };
        document.getElementById('startInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
    } else if (routeMode === 'end') {
        endCoord = { lon, lat };
        document.getElementById('endInput').value = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
    }
    // 添加标注点
    const point = viewer.entities.add({
        position: pos,
        point: { pixelSize: 10, color: (routeMode === 'start' ? Cesium.Color.GREEN : Cesium.Color.BLUE) },
        label: { text: (routeMode === 'start' ? "起点" : "终点"), font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -20) }
    });
    pointsLayer.push(point);
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
document.getElementById('ImageSelect').style.display = 'none';
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
document.getElementById('overviewOfCity').onclick = function() {
    let panel = document.getElementById('ImageSelect');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('routePointAnalysis').onclick = function() {
    let panel = document.getElementById('customInfoBox');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};