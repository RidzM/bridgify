import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
worker_class = "gthread"
workers = 1  # Bridge rooms live in memory; one process keeps them consistent.
threads = 50
timeout = 60
accesslog = "-"
