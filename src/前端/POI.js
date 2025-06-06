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

fetch('杭州餐饮POI.json')
  .then(response => response.json())
  .then(data => {
    allShopData = data;
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
  });

document.getElementById('togglePoiBtn').onclick = function() {
  poiVisible = !poiVisible;
  poiEntities.forEach(e => e.show = poiVisible);
  this.textContent = poiVisible ? "隐藏数据点" : "显示数据点";
};

// 修改POI点击事件，弹出编辑框
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
        <p><strong>电话：</strong>${data.item.tel && data.item.tel.length ? data.item.tel : '暂无'}</p>`;
      infoBox.style.display = 'block';
      
      editingPoint = { lon: data.item.lon, lat: data.item.lat };
      document.getElementById('editBox').style.display = 'block';
      document.getElementById('shopCountResult').textContent = '';
      return;
    }
  }
  infoBox.style.display = 'none';
  document.getElementById('editBox').style.display = 'none';
  editingPoint = null;
  document.getElementById('shopCountResult').textContent = '';
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// 缓冲区按钮功能
document.getElementById('toggleBufferBtn').onclick = function() {
  if (!bufferVisible) {
    // 计算并显示缓冲区
    if (!editingPoint) return;
    const radius = parseFloat(document.getElementById('bufferRadius').value) || 200;
    axios.post('http://127.0.0.1:8000/buffer', {
      lon: editingPoint.lon,
      lat: editingPoint.lat,
      radius: radius
    }).then(res => {
      // 移除旧缓冲区
      if (bufferEntity) {
        viewer.entities.remove(bufferEntity);
        bufferEntity = null;
      }
      const coords = res.data.coordinates;
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
};

// 计算店家数量按钮事件
document.getElementById('countShopBtn').onclick = function() {
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
};

document.getElementById('showDensityBtn').onclick = function() {
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
};

// 关闭编辑框
document.getElementById('closeEditBox').onclick = function() {
  document.getElementById('editBox').style.display = 'none';
  editingPoint = null;
};

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

//数据编辑面板拖拽
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