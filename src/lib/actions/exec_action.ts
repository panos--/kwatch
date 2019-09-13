import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export class ExecAction implements Action {
    public getLabel() {
        return "Exec Bash";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "pods";
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
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

        let width: number = typeof screen.width == "number" ? screen.width : parseInt(screen.width);
        let height: number = typeof screen.height == "number" ? screen.height : parseInt(screen.height);
        screen.clearRegion(0, width, 0, height);
        screen.cursorReset();
        // screen.render();
        screen.program.showCursor();
        screen.program.restoreCursor();
        screen.exec("kubectl", [
            "-n",
            namespace.metadata.name,
            "exec",
            "-it",
            resource,
            "--",
            "bash"
        ], {}, (err, success) => {
            if (err) {
                console.log(err);
            }
        });
    }
}
