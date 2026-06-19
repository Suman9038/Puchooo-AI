import logging
import logging.handlers
import json
from pathlib import Path


LOG_DIR = Path(__file__).parent.parent.parent / "logs" # Log ka folder banaynege jaha mera sara kuch store hoga logs
LOG_DIR.mkdir(parents=True, exist_ok=True) # Agar folder nhi hoga to create kr dega 

class JsonFormatter(logging.Formatter):
    def __init__(self):
        super().__init__()

    def format(self, record: logging.LogRecord) -> str:
        # formatting jo record se information lgegi
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "pathname": record.pathname,
            "lineno": record.lineno,
            "funcName": record.funcName
        }
        # Agar Exception hoga to uski details format krke le lega
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(log_record)

def setup_logger(name:str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler() # Yha pr ham console me output display krne ke liye use krte hai
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('[%(asctime)s] - %(name)s - %(levelname)s - %(message)s', datefmt="%Y-%m-%d %H:%M:%S")
    console_handler.setFormatter(console_formatter)

    # File handler
    file_handler = logging.handlers.RotatingFileHandler(LOG_DIR/ f"{name}.log", maxBytes=10*1024*1024, backupCount=5)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(JsonFormatter())

    # Error log Handler
    error_handler = logging.handlers.RotatingFileHandler(LOG_DIR/ f"{name}_error.log", maxBytes=10*1024*1024, backupCount=5)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JsonFormatter())

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    logger.addHandler(error_handler)
    return logger 


# logging.basicConfig(
#     level= logging.DEBUG,
#     format= '[%(asctime)s] {%(pathname)s:%(lineno)d} %(levelname)s - %(message)s',
#     datefmt='%H:%M:%S'
# )

logger = setup_logger("Puchooo AI")