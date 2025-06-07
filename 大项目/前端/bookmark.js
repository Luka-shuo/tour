// bookmark.js
import { viewer } from './cesiumInit.js';

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