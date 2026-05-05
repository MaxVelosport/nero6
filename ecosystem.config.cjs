module.exports = {
  apps: [{
    name: "api-server",
    script: "artifacts/api-server/dist/index.mjs",
    cwd: "/home/deploy/projects/nero6",
    interpreter: "node",
    interpreter_args: "--env-file=/home/deploy/projects/nero6/.env --enable-source-maps",
    env: {
      NODE_ENV: "production",
      PORT: "3001"
    },
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "512M",
    error_file: "logs/api-server-error.log",
    out_file: "logs/api-server-out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    restart_delay: 3000,
    max_restarts: 10
  }]
};
