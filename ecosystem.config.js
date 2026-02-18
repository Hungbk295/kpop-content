module.exports = {
  apps: [
    {
      name: 'kpop-metrics-cronjob',
      script: './src/cronjob.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cronjob-error.log',
      out_file: './logs/cronjob-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000
    }
  ]
};
