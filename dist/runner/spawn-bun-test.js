import { spawn } from 'node:child_process';
export const spawnBunTest = (argv, options) => {
    const child = spawn('bun', ['test', ...argv], {
        stdio: ['inherit', 'pipe', 'pipe'],
        ...(options === undefined
            ? {}
            : {
                env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !options.omitEnv.includes(key))),
            }),
    });
    const exited = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve({ code, signal }));
    });
    return {
        stdout: child.stdout,
        stderr: child.stderr,
        exited,
        kill: (signal) => {
            child.kill(signal);
        },
    };
};
//# sourceMappingURL=spawn-bun-test.js.map