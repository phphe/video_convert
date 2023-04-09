pm2 stop video_convert  # Stop the running app
pm2 start index.js --name "video_convert" -i max