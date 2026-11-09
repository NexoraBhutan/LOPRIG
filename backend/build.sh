#!/usr/bin/env bash
# Render build step for the Lop-rig API: install packages and collect the admin's static files.
# Database migrations run separately, right before each deploy (see render.yaml preDeployCommand).
set -o errexit
pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --noinput
