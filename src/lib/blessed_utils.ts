import * as blessed from "blessed";
import fs from "fs";

export class BlessedUtils {
    public static executeCommand(screen: blessed.Widgets.Screen, command: string, args: string[],
        callback: (err?: Error, success?: boolean) => void) {
        BlessedUtils.executeCommandInternal(screen, command, args, false, callback);
    }

    public static executeCommandWait(screen: blessed.Widgets.Screen, command: string, args: string[],
        callback: (err?: Error, success?: boolean) => void) {
        BlessedUtils.executeCommandInternal(screen, command, args, true, callback);
    }

    private static executeCommandInternal(screen: blessed.Widgets.Screen, command: string, args: string[],
        wait: boolean, callback: (err?: Error, success?: boolean) => void) {
        // NOTE: Run command in a terminal box inside blessed's screen. Left here just for reference.

        // const term = blessed.terminal({
        //     parent: screen,
        //     label: "Terminal",
        //     shell: "kubectl",
        //     // TODO: specify container
        //     // args: ["-n", namespace, "exec", "-it", resource, "-c", containerName, "--", "bash"],
        //     args: ["-n", namespace.metadata.name, "exec", "-it", resource, "--", "bash"],
        //     top: 0,
        //     left: 0,
        //     width: "100%",
        //     height: "100%",
        //     mouse: true,
        //     keys: true,
        //     border: "line",
        //     scrollbar: {
        //         ch: " ",
        //         track: {
        //             bg: AppDefaults.COLOR_SCROLLBAR_BG
        //         },
        //         style: {
        //             inverse: true
        //         }
        //     },
        // });

        // term.on("exit", () => {
        //     term.write("Finished. Press ENTER to close.");
        //     term.key("enter", () => {
        //         term.kill();
        //         term.destroy();
        //     });
        // });

        // term.focus();
        // screen.render();

        // NOTE: although screen.spawn() does various things to clean up the screen before launching
        // the given command this doesn't work somehow and leave the screen in cluttered state.
        // Therefore, before calling spawn() we run a sequence of commands taken from blessed's
        // exit routine.
        let height = typeof screen.height == "number" ? screen.height : parseInt(screen.height);
        screen.program.csr(0, height - 1);
        screen.program.showCursor();
        screen.alloc();
        screen.program.normalBuffer();
        screen.program.flush();

        screen.log(`executing command: ${command} ${args.join(" ")}`);

        const sigHandler = () => {};
        process.on("SIGINT", sigHandler); // don't get terminated on ctrl-c
        screen.lockKeys = true;
        screen.exec(command, args, {}, (err, success) => {
            if (wait) {
                process.stdout.write("Command finished. Press any key to continue.");
                const arr = new Uint16Array(2);
                fs.readSync(0, arr, 0, 1, null);
                process.stdout.write("\n");
            }
            screen.program.hideCursor();
            screen.lockKeys = false;
            process.off("SIGINT", sigHandler);
            callback(err, success);
        });
    }

    // TODO: This should drop out of blessed screen and run callback, returning to blessed screen when
    // callback finishes. Does not yet work properly. There are obviously things done by Screen.exec()
    // that have to be done here too.
    public static async runOffScreen(screen: blessed.Widgets.Screen, wait: boolean, callback: () => void) {
        let height = typeof screen.height == "number" ? screen.height : parseInt(screen.height);
        screen.program.csr(0, height - 1);
        screen.program.showCursor();
        screen.alloc();
        screen.program.normalBuffer();
        screen.program.flush();

        const sigHandler = () => {};
        process.on("SIGINT", sigHandler); // don't get terminated on ctrl-c
        screen.lockKeys = true;
        screen.exec("true", [], {}, (err, success) => {
            try {
                callback();
            }
            catch (e) {
                console.log(e);
                screen.log(e);
            }
        });
        if (wait) {
            process.stdout.write("Command finished. Press any key to continue.");
            const arr = new Uint16Array(2);
            fs.readSync(0, arr, 0, 1, null);
        }
        screen.program.hideCursor();
        screen.lockKeys = false;
        process.off("SIGINT", sigHandler);
    }
}
