import time

from fastapi import FastAPI
from database import Base, engine
from models.user import User
from routers.users import router as users_router
from models.menu import MenuItem
from routers.menu import router as menu_router


Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(users_router)
app.include_router(menu_router)

@app.get("/")
def root():
    return {"message": "Restaurant API is running"}

@app.middleware("http")
async def log_requests(request, call_next):

    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time

    print(
        f"{request.method} {request.url.path} "
        f"- {process_time:.4f} seconds"
    )

    return response