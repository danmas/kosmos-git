module.exports = {
  apps: [
    {
      name: 'kosmos-git',
      script: 'C:\\Users\\roman\\.bun\\bin\\bun.exe',
      args: 'server/index.ts',
      cwd: 'C:\\ERV\\projects-ex\\kosmos-git',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3006
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
