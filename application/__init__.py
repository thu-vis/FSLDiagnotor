from flask import Flask
from flask_session import Session
from flask_compress import Compress

# from datetime import timedelta
from .views.admin import admin
from .views.data import data

compress = Compress()

def create_app():
    app = Flask(__name__)
    app.config['SESSION_TYPE'] = 'null'
    Session(app)
    compress.init_app(app)

    app.config.from_object("config.DevelopmentConfig")

    app.register_blueprint(admin)
    app.register_blueprint(data)

    return app