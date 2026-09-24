from flask import Flask
from flask_migrate import Migrate
from backend.extensions import db
from backend.routes import api_bp
from flask_cors import CORS



def create_app():
    app = Flask(__name__, template_folder='templates')
    CORS(app)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///./testdb.db'
    
    db.init_app(app)
    from backend import models
    Migrate(app, db)

    app.register_blueprint(api_bp)
    return app
