import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export class ExecLoginShellAction implements Action {
    public getLabel() {
        return "Exec Login Shell";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "pods";
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const term = blessed.terminal({
            parent: screen,
            label: "Terminal",
            shell: "kubectl",
            // TODO: specify container
            // args: ["-n", namespace, "exec", "-it", resource, "-c", containerName, "--", "bash"],
            args: ["-n", namespace.metadata.name, "exec", "-it", resource, "--", "sh", "-il"],
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            mouse: true,
            keys: true,
            border: "line",
            scrollbar: {
                ch: " ",
                track: {
                    bg: "cyan"
                },
                style: {
                    inverse: true
                }
            },
        });
        
        term.on("exit", () => {
            term.write("Finished. Press ENTER to close.");
            term.key("enter", () => {
                term.kill();
                term.destroy();
            });
        });

        term.focus();
        screen.render();
    }
}
