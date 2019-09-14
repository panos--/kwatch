import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { AppDefaults } from "../app_defaults";
import { BlessedUtils } from "../blessed_utils";

export abstract class ExecAction implements Action {
    public abstract getLabel(): string;

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "pods";
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        client.getPod(resource, namespace.metadata.name).then(pod => {
            let containers = pod.spec.containers.map(container => { return container.name; });
            if (containers.length == 0) {
                // should not happen
                throw "no containers found in pod";
            }
            else if (containers.length == 1) {
                this.executeCommandInternal(screen, namespace, resource, containers[0]);
            }
            else {
                const lengths = containers.map(value => { return value.length; });
                let maxLength = Math.max.apply(null, lengths);
                const label = "Choose Container";
                const containerMenu = blessed.list({
                    parent: screen,
                    label: label,
                    top: "center",
                    left: "center",
                    width: Math.min(Math.max(maxLength, label.length + 2) + 2, 50),
                    height: 8,
                    mouse: true,
                    keys: true,
                    border: "line",
                    items: containers,
                    shrink: true,
                    style: {
                        item: {
                            hover: {
                                bg: "blue",
                                fg: "white",
                            }
                        },
                        selected: {
                            bg: "blue",
                            fg: "white",
                            bold: true
                        }
                    },
                });
                containerMenu.style.border.bg = AppDefaults.COLOR_BG_FOCUS;
                containerMenu.on("blur", () => {
                    containerMenu.hide();
                    containerMenu.destroy();
                });
                containerMenu.on("cancel", () => {
                    containerMenu.hide();
                    containerMenu.destroy();
                });
                containerMenu.on("select", (item, index) => {
                    containerMenu.hide();
                    containerMenu.destroy();
                    this.executeCommandInternal(screen, namespace, resource, containers[index]);
                });
                screen.saveFocus();
                containerMenu.focus();
                containerMenu.show();
                containerMenu.select(0);
                screen.render();
            }
        }, reason => {
            // FIXME: Handle error
            console.log(reason);
        }).catch(reason => {
            // FIXME: Handle error
            console.log(reason);
        });
    }

    protected abstract executeCommand(screen: blessed.Widgets.Screen, namespace: V1Namespace, resource: string, container: string,
        execCallback: (command: string, args?: string[]) => void): void;

    private executeCommandInternal(screen: blessed.Widgets.Screen, namespace: V1Namespace, resource: string, container: string) {
        this.executeCommand(screen, namespace, resource, container, (command: string, args: string[], wait?: boolean) => {
            const kubectlCmd = "kubectl";
            const kubectlArgs = [
                "-n",
                namespace.metadata.name,
                "exec",
                "-it",
                resource,
                "-c",
                container,
                "--"
            ];
            kubectlArgs.push(command);
            if (args) {
                kubectlArgs.push.apply(kubectlArgs, args);
            }

            const resultCallback = (err, success) => {
                if (err) {
                    console.log(err);
                }
                if (!success) {
                    console.log("Command returned with non-zero exit code");
                }
            };
            if (wait) {
                BlessedUtils.executeCommandWait(screen, kubectlCmd, kubectlArgs, resultCallback);
            }
            else {
                BlessedUtils.executeCommand(screen, kubectlCmd, kubectlArgs, resultCallback);
            }
        });
    }
}
