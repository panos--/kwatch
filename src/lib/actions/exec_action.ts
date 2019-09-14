import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export abstract class ExecAction implements Action {
    public abstract getLabel(): string;

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "pods";
    }

    protected abstract getCommand(): string[];

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
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
        //             bg: "cyan"
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

        const args = [
            "-n",
            namespace.metadata.name,
            "exec",
            "-it",
            resource,
            "--"
        ];
        args.push.apply(args, this.getCommand());

        screen.exec("kubectl", args, {}, (err, success) => {
            if (err) {
                console.log(err);
            }
            if (!success) {
                console.log("Command returned with non-zero exit code");
            }
            screen.program.hideCursor();
        });
    }
}
