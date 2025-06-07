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
document.getElementById('cesiumContainer').oncontextmenu = () => false;

// ================== 图层切换 ==================
const Gaode_Road = new Cesium.UrlTemplateImageryProvider({
    url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
});
viewer.imageryLayers.addImageryProvider(Gaode_Road);

// ================== 商家/路线收藏（前端本地存储） ==================
function saveBookmark(type, name, camera) {
    const key = type === 'shop' ? 'shopBookmarks' : 'routeBookmarks';
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
    renderBookmarks(type, bookmarks);
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
        if (routeEntity) viewer.entities.remove(routeEntity);
        routeEntity = viewer.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(data.coords),
                width: 5,
                material: Cesium.Color.RED,
                clampToGround: true
            }
        });
        viewer.zoomTo(routeEntity);
        const minutes = Math.round(data.duration / 60);
        const kilometers = (data.distance / 1000).toFixed(2);
        document.getElementById("routeInfo").innerText = `预计用时：${minutes} 分钟，距离：${kilometers} 公里`;
    } catch (error) {
        alert("请求失败：" + error);
        console.error(error);
    }
});

// 路线选点（中键点击）
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
}, Cesium.ScreenSpaceEventType.MIDDLE_CLICK);

// ================== 视角控制 ==================
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

// ================== 初始隐藏及面板控制 ==================
document.getElementById('controlPanel').style.display = 'none';
document.getElementById('MapMark').style.display = 'none';
document.getElementById('customInfoBox').style.display = 'none';
document.getElementById('editBox').style.display = 'none';
document.getElementById('routeAnalysis').onclick = function() {
    let panel = document.getElementById('controlPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('userCollection').onclick = function() {
    let panel = document.getElementById('MapMark');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('routePointAnalysis').onclick = function() {
    let panel = document.getElementById('customInfoBox');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('overviewOfCity').onclick = function() {
    let panel = document.getElementById('editBox');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        window.editBoxMode = 'button';
    } else {
        panel.style.display = 'none';
        window.editBoxMode = null;
    }
};
document.getElementById('closeEditBox').onclick = function() {
    if (window.editBoxMode === 'button') {
        window.editBoxMode = null;
    }
};

// ================== 地图制作功能 ==================
document.getElementById('mapMaker').onclick = function() {
    let panel = document.getElementById('mapMakerPanel');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
document.getElementById('captureMap').addEventListener('click', function() {
    try {
        const cesiumCanvas = viewer.scene.canvas;
        viewer.render();
        const image = cesiumCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = '浙里食光地图_' + new Date().toISOString().slice(0,19).replace(/[:]/g, '-') + '.png';
        link.href = image;
        link.click();
        alert('地图截图已保存！（仅地图内容）');
    } catch (error) {
        alert('截图失败，请重试！\n错误信息：' + error.message);
    }
});

// ========== ECharts 图表功能整合 ==========
let data = [];
let selectedField = null;
let selectedChartType = null;
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
RegionButtons.forEach(btn => { btn.disabled = true; });
// 点击第一排按钮
fieldButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedField = btn.getAttribute('data-field');
    updateActive(fieldButtons, btn);
    tryRenderChart();
    if (selectedField === 'adname') {
      RegionButtons.forEach(btn => { btn.disabled = true; });
    } else {
      RegionButtons.forEach(btn => { btn.disabled = false; });
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
  if (!selectedField || !selectedChartType || !selectedRegion) {
    myChart.clear();
    return;
  }
  myChart.clear();
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
  const counts = {};
  filteredData.forEach(item => {
    const val = item[selectedField] || '未知';
    counts[val] = (counts[val] || 0) + 1;
  });
  const total = filteredData.length;
  const entries = Object.entries(counts);
  if (selectedChartType === 'pie') {
    const pieData = entries.map(([name, value]) => ({ name, value }));
    const option = {
      tooltip: { trigger: 'item' },
      series: [{
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
        label: { formatter: '{b}: {d}%' }
      }]
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
        axisLabel: { interval: 0, rotate: 30, show: showXAxisLabels }
      },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}' } },
      series: [{
        data: entries.map(e => e[1]),
        type: 'bar',
        itemStyle: { color: '#5470C6' }
      }]
    };
    myChart.setOption(option);
  }
}
// 异步加载本地 杭州餐饮POI.json，初始化 data 数组
fetch('./杭州餐饮POI.json')
  .then(response => response.json())
  .then(jsonData => { data = jsonData; })
  .catch(err => { console.error('加载 杭州餐饮POI.json 失败:', err); });
document.getElementById('ECharts-box').style.display = 'none';
document.getElementById('control-EChartbox').onclick = function() {
    let panel = document.getElementById('ECharts-box');
    panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
};
fieldButtons[0].click();
chartTypeButtons[0].click();
RegionButtons[0].click();

// ================== 天气降水特效 ==================
let rainEffect;
class RainEffect {
  constructor(viewer, options) {
    if (!viewer) throw new Error("no viewer object!");
    options = options || {};
    this.tiltAngle = Cesium.defaultValue(options.tiltAngle, -0.6);
    this.rainSize = Cesium.defaultValue(options.rainSize, 0.8);
    this.rainSpeed = Cesium.defaultValue(options.rainSpeed, 120.0);
    this.viewer = viewer;
    this.init();
  }
  init() {
    this.rainStage = new Cesium.PostProcessStage({
      name: "czm_rain",
      fragmentShader: this.rain(),
      uniforms: {
        tiltAngle: () => this.tiltAngle,
        rainSize: () => this.rainSize,
        rainSpeed: () => this.rainSpeed
      }
    });
    this.viewer.scene.postProcessStages.add(this.rainStage);
  }
  destroy() {
    if (!this.viewer || !this.rainStage) return;
    if (!this.rainStage.isDestroyed?.()) {
      this.rainStage.destroy();
    }
    this.viewer.scene.postProcessStages.remove(this.rainStage);
    this.rainStage = null;
  }
  show(visible) {
    if (this.rainStage) {
      this.rainStage.enabled = visible;
    }
  }
  rain() {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float tiltAngle;
      uniform float rainSize;
      uniform float rainSpeed;
      float hash(float x) {
          return fract(sin(x * 133.3) * 13.13);
      }
      out vec4 fragColor;
      void main(void) {
          float time = czm_frameNumber / rainSpeed;
          vec2 resolution = czm_viewport.zw;
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          vec3 c = vec3(0.6, 0.7, 0.8);
          float a = tiltAngle;
          float si = sin(a), co = cos(a);
          uv *= mat2(co, -si, si, co);
          uv *= length(uv + vec2(0, 4.9)) * rainSize + 1.0;
          float v = 1.0 - sin(hash(floor(uv.x * 30.0)) * 2.0);
          float b = clamp(abs(sin(20.0 * time * v + uv.y * (5.0 / (2.0 + v)))) - 0.95, 0.0, 1.0) * 20.0;
          c *= v * b;
          fragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(c, 1.0), 0.15);
      }
    `;
  }
}
function startRain() {
  if (!rainEffect) {
    rainEffect = new RainEffect(viewer, {
      tiltAngle: -0.3,
      rainSize: 0.8,
      rainSpeed: 400.0
    });
  }
  rainEffect.show(true);
}
function stopRain() {
  if (rainEffect) {
    rainEffect.show(false);
  }
}
async function getHangzhouWeather() {
  const lon = 120.153576;
  const lat = 30.287459;
  const weatherIcon = document.querySelector('.icon');
  const apiKey = 'e85c31783b23b441bab3e073fe394401';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=zh_cn`;
  const response = await fetch(url);
  var data = await response.json();
  document.querySelector("#tem").innerHTML = data.main.temp + '°C';
  switch (data.weather[0].main) {
    case 'Clouds':
      weatherIcon.src = '前端图/cloudy.png';
      document.querySelector("#wea-E").innerHTML = 'cloudy';
      document.querySelector("#wea-C").innerHTML = '多云';
      stopRain();
      break;
    case 'Clear':
      weatherIcon.src = '前端图/sunny.png';
      document.querySelector("#wea-E").innerHTML = 'sunny';
      document.querySelector("#wea-C").innerHTML = '晴';
      stopRain();
      break;
    case 'Rain':
      weatherIcon.src = '前端图/rainny.png';
      document.querySelector("#wea-E").innerHTML = 'rainy';
      document.querySelector("#wea-C").innerHTML = '雨';
      startRain();
      break;
    default:
      weatherIcon.src = '前端图/otherweather.png';
      document.querySelector("#wea-E").innerHTML = 'other';
      document.querySelector("#wea-C").innerHTML = '其他';
      stopRain();
      break;
  }
}
let weatherTimeout;
function showWeatherPanel() {
    const panel = document.getElementById('weather-panel');
    getHangzhouWeather();
    if (weatherTimeout) clearTimeout(weatherTimeout);
    panel.classList.remove('hiding');
    panel.classList.add('visible');
    weatherTimeout = setTimeout(() => {
      panel.classList.add('hiding');
      setTimeout(() => {
        panel.classList.remove('visible');
      }, 500);
    }, 5000);
}
document.addEventListener('DOMContentLoaded', function() {
    var panel = document.getElementById('weather-panel');
    var dragging = false;
    var lastX;
    var lastY;
    panel.addEventListener('mousedown', function(e) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        showWeatherPanel();
    });
    document.addEventListener('mousemove', function(e) {
        if (dragging) {
            var deltaX = e.clientX - lastX;
            var deltaY = e.clientY - lastY;
            var newX = panel.offsetLeft + deltaX;
            var newY = panel.offsetTop + deltaY;
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });
    document.addEventListener('mouseup', function() {
        dragging = false;
    });
});

// ================== 圆扩散粒子效果 ==================
class CircleDiffusion {
    constructor(viewer) {
        this.viewer = viewer;
        this.currentDiffusion = null;
    }
    add(position, scanColor, maxRadius, duration) {
        if (this.currentDiffusion) {
            this.viewer.scene.postProcessStages.remove(this.currentDiffusion);
        }
        const cartographicCenter = new Cesium.Cartographic(
            Cesium.Math.toRadians(position[0]),
            Cesium.Math.toRadians(position[1]),
            position[2]
        );
        scanColor = new Cesium.Color.fromCssColorString(scanColor);
        this.currentDiffusion = this._createDiffusionStage(cartographicCenter, maxRadius, scanColor, duration);
        this.viewer.scene.postProcessStages.add(this.currentDiffusion);
    }
    clear() {
        if (this.currentDiffusion) {
            this.viewer.scene.postProcessStages.remove(this.currentDiffusion);
            this.currentDiffusion = null;
        }
    }
    _createDiffusionStage(cartographicCenter, maxRadius, scanColor, duration) {
        const center = Cesium.Cartographic.toCartesian(cartographicCenter);
        const center1 = Cesium.Cartographic.toCartesian(new Cesium.Cartographic(
            cartographicCenter.longitude,
            cartographicCenter.latitude,
            cartographicCenter.height + 500
        ));
        const time = new Date().getTime();
        const scratchCenter = new Cesium.Cartesian4();
        const scratchCenter1 = new Cesium.Cartesian4();
        const scratchNormal = new Cesium.Cartesian3();
        return new Cesium.PostProcessStage({
            fragmentShader: this._getFragmentShader(),
            uniforms: {
                u_scanCenterEC: () => {
                    return Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center.x, center.y, center.z, 1),
                        scratchCenter
                    );
                },
                u_scanPlaneNormalEC: () => {
                    const temp = Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center.x, center.y, center.z, 1),
                        scratchCenter
                    );
                    const temp1 = Cesium.Matrix4.multiplyByVector(
                        viewer.camera._viewMatrix,
                        new Cesium.Cartesian4(center1.x, center1.y, center1.z, 1),
                        scratchCenter1
                    );
                    scratchNormal.x = temp1.x - temp.x;
                    scratchNormal.y = temp1.y - temp.y;
                    scratchNormal.z = temp1.z - temp.z;
                    Cesium.Cartesian3.normalize(scratchNormal, scratchNormal);
                    return scratchNormal;
                },
                u_radius: () => {
                    return (maxRadius * ((new Date().getTime() - time) % duration)) / duration;
                },
                u_scanColor: scanColor
            }
        });
    }
    _getFragmentShader() {
        return `
            uniform sampler2D colorTexture;
            uniform sampler2D depthTexture;
            in vec2 v_textureCoordinates;
            uniform vec4 u_scanCenterEC;
            uniform vec3 u_scanPlaneNormalEC;
            uniform float u_radius;
            uniform vec4 u_scanColor;
            out vec4 fragColor;
            vec4 toEye(in vec2 uv, in float depth) {
                vec2 xy = vec2((uv.x * 2.0 - 1.0), (uv.y * 2.0 - 1.0));
                vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
                posInCamera = posInCamera / posInCamera.w;
                return posInCamera;
            }
            vec3 pointProjectOnPlane(in vec3 planeNormal, in vec3 planeOrigin, in vec3 point) {
                vec3 v01 = point - planeOrigin;
                float d = dot(planeNormal, v01);
                return (point - planeNormal * d);
            }
            float getDepth(in vec4 depth) {
                float z_window = czm_unpackDepth(depth);
                z_window = czm_reverseLogDepth(z_window);
                float n_range = czm_depthRange.near;
                float f_range = czm_depthRange.far;
                return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
            }
            void main() {
                fragColor = texture(colorTexture, v_textureCoordinates);
                float depth = getDepth(texture(depthTexture, v_textureCoordinates));
                vec4 viewPos = toEye(v_textureCoordinates, depth);
                vec3 prjOnPlane = pointProjectOnPlane(u_scanPlaneNormalEC, u_scanCenterEC.xyz, viewPos.xyz);
                float dis = length(prjOnPlane - u_scanCenterEC.xyz);
                if(dis < u_radius) {
                    float f = 1.0 - abs(u_radius - dis) / u_radius;
                    f = pow(f, 18.0);
                    fragColor = mix(fragColor, u_scanColor, f);
                }
                fragColor.a = fragColor.a / 2.0;
            }
        `;
    }
}
const circleDiffusion = new CircleDiffusion(viewer);
const statusElement = document.getElementById('status');
let diffusionEnabled = true;
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function(movement) {
    if (!diffusionEnabled) return;
    const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const color = document.getElementById('circleColor').value;
        const radius = parseInt(document.getElementById('circleRadius').value);
        const duration = parseInt(document.getElementById('circleDuration').value);
        circleDiffusion.add([longitude, latitude, 0], color, radius, duration);
        statusElement.textContent = `在 [${longitude.toFixed(4)}, ${latitude.toFixed(4)}] 添加了圆扩散`;
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
document.getElementById('diffusionToggle').addEventListener('change', function() {
    diffusionEnabled = this.checked;
    if (!diffusionEnabled) {
        circleDiffusion.clear();
        statusElement.textContent = '点击扩散: 已禁用（扩散效果已清除）';
    } else {
        statusElement.textContent = '点击扩散: 已启用';
    }
});