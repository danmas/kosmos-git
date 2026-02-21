module.exports = {
  apps: [
    {
      name: 'kosmos-git',
      script: 'server/index.ts',
      interpreter: 'bun',
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
