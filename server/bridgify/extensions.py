from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO

cors = CORS()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", default_limits=[])
socketio = SocketIO()
