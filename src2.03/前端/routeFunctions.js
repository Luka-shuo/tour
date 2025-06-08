// routeFunctions.js
import { viewer } from './cesiumInit.js';

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
        console.error
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
}, Cesium.ScreenSpaceEventType.MIDDLE_CLICK);

// ================== 美食POI展示及分析 ==================
const pinBuilder = new Cesium.PinBuilder();
const infoBox = document.getElementById('customInfoBox');
const entityInfoMap = new Map();
let lastSelected = null;
let editingPoint = null;
let bufferEntity = null;
let bufferPolygonCoords = null;
let allShopData = [];
let densityEntities = [];
let poiEntities = [];
let densityVisible = false;
let poiVisible = true;
let bufferVisible = false;

// 加载餐饮POI数据
fetch('杭州餐饮POI.json')
  .then(response => response.json())
  .then(data => {
    allShopData = data;
    window.allShopData = allShopData;
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
      poiEntities.push(entity);
    });
    viewer.zoomTo(viewer.entities);
    window.poiEntities = poiEntities;
    window.entityInfoMap = entityInfoMap;
  });
//加载景点POI
// ================== 景点POI展示 ==================
const scenicSpotInfoMap = new Map();
// 修改为使用 let 声明
let scenicSpotLastSelected = null;

function transformWGS84ToGCJ02(lon, lat) {
    if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) {
        return [lon, lat];
    }
    let dLat = transformLat(lon - 105.0, lat - 35.0);
    let dLon = transformLon(lon - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - 0.00669342162296594323 * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((6335552.717000426 / (magic * sqrtMagic)) * Math.PI);
    dLon = (dLon * 180.0) / ((6378245.0 / sqrtMagic) * Math.cos(radLat) * Math.PI);
    const mgLat = lat + dLat;
    const mgLon = lon + dLon;
    return [mgLon, mgLat];
}
function transformLat(x, y) {
    return -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 
           0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)) +
           (20.0 * Math.sin(6.0 * x * Math.PI) + 
            20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0 +
           (20.0 * Math.sin(y * Math.PI) + 
            40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0 +
           (160.0 * Math.sin(y / 12.0 * Math.PI) + 
            320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
}
function transformLon(x, y) {
    return 300.0 + x + 2.0 * y + 0.1 * x * x + 
           0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)) +
           (20.0 * Math.sin(6.0 * x * Math.PI) + 
            20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0 +
           (20.0 * Math.sin(x * Math.PI) + 
            40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0 +
           (150.0 * Math.sin(x / 12.0 * Math.PI) + 
            300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
}

fetch('景点.json')
  .then(response => response.json())
  .then(data => {
    data.forEach(item => {
        const defaultIcon = pinBuilder.fromText('🗻', Cesium.Color.BLUE, 32).toDataURL();
        const highlightIcon = pinBuilder.fromText('🗻', Cesium.Color.CYAN, 40).toDataURL();
        const lon = parseFloat(item.经度BD_wgs84);
        const lat = parseFloat(item.纬度BD_wgs84);
        const [gcjLon, gcjLat] = transformWGS84ToGCJ02(lon, lat);
        const entity = viewer.entities.add({
            id: Cesium.createGuid(),
            name: item.景区名称,
            position: Cesium.Cartesian3.fromDegrees(gcjLon, gcjLat),
            billboard: {
            image: defaultIcon,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
        scenicSpotInfoMap.set(entity.id, { item, defaultIcon, highlightIcon });
        });

    viewer.zoomTo(viewer.entities);
  });
// POI显示/隐藏按钮
document.getElementById('togglePoiBtn')?.addEventListener('click', function() {
  poiVisible = !poiVisible;
  poiEntities.forEach(e => e.show = poiVisible);
  this.textContent = poiVisible ? "隐藏数据点" : "显示数据点";
});

// POI点击事件，弹出信息框和编辑框
viewer.screenSpaceEventHandler.setInputAction(evt => {
  // 路线选点优先
  if (routeMode) return; // 路线选点已用中键，不影响左键POI

  // POI点击逻辑
    const picked = viewer.scene.pick(evt.position);
    if (lastSelected) {
        const info = entityInfoMap.get(lastSelected.id);
        lastSelected.billboard.image = info.defaultIcon;
        lastSelected = null;
    }
    if (scenicSpotLastSelected) {
        const info = scenicSpotInfoMap.get(scenicSpotLastSelected.id);
        scenicSpotLastSelected.billboard.image = info.defaultIcon;
        scenicSpotLastSelected = null;
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
            editingPoint = { lon: data.item.lon, lat: data.item.lat };
            document.getElementById('shopCountResult').textContent = '';
            return;
        }
        const scenicSpotData = scenicSpotInfoMap.get(picked.id.id);
        if (scenicSpotData) {
            picked.id.billboard.image = scenicSpotData.highlightIcon;
            scenicSpotLastSelected = picked.id;
            infoBox.innerHTML = `
                <h3>${scenicSpotData.item.景区名称}</h3>
                <p><strong>景区等级：</strong>${scenicSpotData.item.景区等级}</p>
            `;
            infoBox.style.display = 'block';
            return;
        }
    }
    infoBox.style.display = 'none';
    document.getElementById('editBox').style.display = 'none';
    editingPoint = null;
    document.getElementById('shopCountResult').textContent = '';
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// 缓冲区按钮功能
document.getElementById('toggleBufferBtn')?.addEventListener('click', function() {
  if (!bufferVisible) {
    // 计算并显示缓冲区
    if (!editingPoint) return;
    const radius = parseFloat(document.getElementById('bufferRadius').value) || 200;
    fetch('http://127.0.0.1:8000/buffer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lon: editingPoint.lon,
        lat: editingPoint.lat,
        radius: radius
      })
    })
    .then(res => res.json())
    .then(res => {
      // 移除旧缓冲区
      if (bufferEntity) {
        viewer.entities.remove(bufferEntity);
        bufferEntity = null;
      }
      const coords = res.coordinates;
      bufferPolygonCoords = coords;
      const flat = [];
      coords.forEach(c => { flat.push(c[0], c[1]); });
      bufferEntity = viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
          material: Cesium.Color.BLUE.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.BLUE
        }
      });
      bufferVisible = true;
      this.textContent = "删除缓冲区";
      document.getElementById('shopCountResult').textContent = '';
    }).catch(() => alert('缓冲区计算失败'));
  } else {
    // 删除缓冲区
    if (bufferEntity) {
      viewer.entities.remove(bufferEntity);
      bufferEntity = null;
    }
    bufferPolygonCoords = null;
    bufferVisible = false;
    this.textContent = "计算缓冲区";
    document.getElementById('shopCountResult').textContent = '';
  }
});

// 计算店家数量按钮事件
document.getElementById('countShopBtn')?.addEventListener('click', function() {
  if (!bufferPolygonCoords || !allShopData.length) {
    document.getElementById('shopCountResult').textContent = '请先生成缓冲区';
    return;
  }
  // 使用射线法判断点是否在多边形内
  function pointInPolygon(lon, lat, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  let count = 0;
  for (const shop of allShopData) {
    if (shop.lon && shop.lat && pointInPolygon(Number(shop.lon), Number(shop.lat), bufferPolygonCoords)) {
      count++;
    }
  }
  document.getElementById('shopCountResult').textContent = `数量: ${count}`;
});

// 店家数量分布图按钮
document.getElementById('showDensityBtn')?.addEventListener('click', function() {
  if (densityVisible) {
    // 已显示，点击则移除
    densityEntities.forEach(e => viewer.entities.remove(e));
    densityEntities = [];
    densityVisible = false;
    this.textContent = "显示店家数量分布图";
    return;
  }

  // 未显示，点击则生成
  if (!allShopData.length) {
    alert('无店家数据');
    return;
  }

  // 1. 计算所有店家的经纬度范围
  const lons = allShopData.map(s => Number(s.lon));
  const lats = allShopData.map(s => Number(s.lat));
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);

  // 2. 设定分割块数
  const gridX = 10, gridY = 10;
  const stepLon = (maxLon - minLon) / gridX;
  const stepLat = (maxLat - minLat) / gridY;

  // 3. 统计每块内的店家数量
  let maxCount = 0;
  const gridCounts = [];
  for (let i = 0; i < gridX; i++) {
    for (let j = 0; j < gridY; j++) {
      const left = minLon + i * stepLon;
      const right = left + stepLon;
      const bottom = minLat + j * stepLat;
      const top = bottom + stepLat;
      const count = allShopData.filter(s =>
        Number(s.lon) >= left && Number(s.lon) < right &&
        Number(s.lat) >= bottom && Number(s.lat) < top
      ).length;
      gridCounts.push({i, j, left, right, bottom, top, count});
      if (count > maxCount) maxCount = count;
    }
  }

  // 4. 按数量符号化（颜色深浅）
  function getColor(count) {
    if (maxCount === 0) return Cesium.Color.LIGHTGRAY.withAlpha(0.2);
    const ratio = count / maxCount;
    // 渐变色：蓝->绿->黄->红
    if (ratio < 0.2) return Cesium.Color.BLUE.withAlpha(0.3);
    if (ratio < 0.4) return Cesium.Color.GREEN.withAlpha(0.3);
    if (ratio < 0.7) return Cesium.Color.YELLOW.withAlpha(0.3);
    return Cesium.Color.RED.withAlpha(0.4);
  }

  // 5. 绘制每个网格块
  gridCounts.forEach(cell => {
    if (cell.count === 0) return;
    const rect = [
      cell.left, cell.bottom,
      cell.right, cell.bottom,
      cell.right, cell.top,
      cell.left, cell.top
    ];
    const entity = viewer.entities.add({
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(rect),
        material: getColor(cell.count),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 10,
      },
      label: {
        text: cell.count.toString(),
        font: "bold 16px sans-serif",
        fillColor: Cesium.Color.BLACK,
        style: Cesium.LabelStyle.FILL,
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.7),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        position: Cesium.Cartesian3.fromDegrees(
          (cell.left + cell.right) / 2,
          (cell.bottom + cell.top) / 2
        )
      },
      position: Cesium.Cartesian3.fromDegrees(
        (cell.left + cell.right) / 2,
        (cell.bottom + cell.top) / 2
      )
    });
    densityEntities.push(entity);
  });

  densityVisible = true;
  this.textContent = "隐藏店家数量分布图";
});

// 关闭编辑框
document.getElementById('closeEditBox')?.addEventListener('click', function() {
  document.getElementById('editBox').style.display = 'none';
  editingPoint = null;
});

// 信息面板拖拽
(function() {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  const infoBox = document.getElementById('customInfoBox');

  infoBox.style.position = 'absolute';
  if (!infoBox.style.left) infoBox.style.left = 'auto';
  if (!infoBox.style.top) infoBox.style.top = 'auto';

  infoBox.addEventListener('mousedown', function(e) {
    if (e.target.id === 'closeInfoBoxBtn') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = infoBox.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      let newLeft = startLeft + (e.clientX - startX);
      let newTop = startTop + (e.clientY - startY);
      newLeft = Math.max(0, Math.min(window.innerWidth - infoBox.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - infoBox.offsetHeight, newTop));
      infoBox.style.left = newLeft + 'px';
      infoBox.style.top = newTop + 'px';
      infoBox.style.right = 'auto';
      infoBox.style.bottom = 'auto';
    }
  });
  document.addEventListener('mouseup', function() {
    isDragging = false;
    document.body.style.userSelect = '';
  });
})();

// 数据编辑面板拖拽
(function() {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  const infoBox = document.getElementById('editBox');

  infoBox.style.position = 'absolute';
  if (!infoBox.style.left) infoBox.style.left = 'auto';
  if (!infoBox.style.top) infoBox.style.top = 'auto';

  infoBox.addEventListener('mousedown', function(e) {
    if (e.target.id === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = infoBox.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      let newLeft = startLeft + (e.clientX - startX);
      let newTop = startTop + (e.clientY - startY);
      newLeft = Math.max(0, Math.min(window.innerWidth - infoBox.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - infoBox.offsetHeight, newTop));
      infoBox.style.left = newLeft + 'px';
      infoBox.style.top = newTop + 'px';
      infoBox.style.right = 'auto';
      infoBox.style.bottom = 'auto';
    }
  });
  document.addEventListener('mouseup', function() {
    isDragging = false;
    document.body.style.userSelect = '';
  });
})();
// ================== 美食POI展示及分析 END ==================

// ================== 路线点分析功能 ==================
let routeBufferEntity = null;
let routeBufferOriginalPoiEntities = new Map();
let routeBufferIsAnalyzing = false;


// 开始分析
document.getElementById('startAnalysis')?.addEventListener('click', async function() {
    if (!routeEntity) {
        alert('请先进行路线分析！');
        return;
    }
    if (routeBufferIsAnalyzing) {
        alert('分析正在进行中！');
        return;
    }
    routeBufferIsAnalyzing = true;
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
        if (data.error) throw new Error(data.error);

        // 显示缓冲区
        if (routeBufferEntity) viewer.entities.remove(routeBufferEntity);
        const coordinates = data.buffer_geometry.coordinates[0];
        const bufferPositions = [];
        for (const coord of coordinates) {
            bufferPositions.push(coord[0], coord[1], 0);
        }
        routeBufferEntity = viewer.entities.add({
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
        if (poiInfoPanel) poiInfoPanel.innerHTML = '';

        // 保存原始POI实体状态
        routeBufferOriginalPoiEntities.clear();
        viewer.entities.values.forEach(entity => {
            if (entity.billboard && entity.billboard.image) {
                routeBufferOriginalPoiEntities.set(entity.id, {
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
        if (poiInfoPanel) {
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
            poiInfoPanel.style.display = 'block';
        }
    } catch (error) {
        alert('分析失败：' + error.message);
    }
    routeBufferIsAnalyzing = false;
});

// 结束分析
document.getElementById('endAnalysis')?.addEventListener('click', function() {
    if (!routeBufferIsAnalyzing && !routeBufferEntity) return;
    // 移除缓冲区
    if (routeBufferEntity) {
        viewer.entities.remove(routeBufferEntity);
        routeBufferEntity = null;
    }
    // 恢复POI显示状态
    routeBufferOriginalPoiEntities.forEach((state, id) => {
        const entity = viewer.entities.getById(id);
        if (entity) {
            entity.show = state.visible;
            entity.billboard.image = state.image;
        }
    });
    // 隐藏POI信息面板
    const poiInfoPanel = document.getElementById('poiInfoPanel');
    if (poiInfoPanel) poiInfoPanel.style.display = 'none';
    routeBufferIsAnalyzing = false;
});


