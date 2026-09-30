import json
import logging
import sys
import time

# Structured logs: one JSON object per line, so a host's log search can filter on any field,
# e.g. event="room_finished" or status>=500.

logger = logging.getLogger("quizzr")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "event": record.getMessage(),
            **getattr(record, "fields", {}),
        }
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure():
    if logger.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def log_event(event, level=logging.INFO, **fields):
    logger.log(level, event, extra={"fields": fields})
