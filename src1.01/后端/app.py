from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import uvicorn

app = FastAPI(title="路径规划")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get_index():
    return FileResponse("templates/index.html")

# 路径规划接口（异步，返回路线点、时长、距离）
@app.get("/api/route")
async def get_route(
    origin: str = Query(..., description="起点经纬度,如120.1,30.2"),
    destination: str = Query(..., description="终点经纬度,如120.2,30.3")
):
    key = "4c28ae0516ecbfef440117e3aadefff0"  # ⚠️ 替换为真实 key
    url = (
        f"https://restapi.amap.com/v5/direction/driving?"
        f"key={key}&origin={origin}&destination={destination}&show_fields=cost,polyline"
    )
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
            js = res.json()
        path = js['route']['paths'][0]
        steps = path['steps']
        pts = []
        duration = 0
        for s in steps:
            # 有些步可能没有cost字段，需容错
            if 'cost' in s and 'duration' in s['cost']:
                duration += int(s['cost']['duration'])
            pts.extend(s['polyline'].split(';'))
        coords = []
        for pt in pts:
            lon, lat = map(float, pt.split(','))
            coords.extend([lon, lat])
        return JSONResponse(content={
            "coords": coords,
            "duration": duration,     # 单位：秒
            "distance": path.get('distance', 0)      # 单位：米
        })
    except Exception as e:
        print("错误:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
