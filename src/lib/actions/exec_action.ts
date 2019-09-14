import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { BlessedUtils } from "../blessed_utils";
import { ContainerPicker } from "../widgets/container_picker";

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
                const containerPicker = new ContainerPicker(containers, screen);
                containerPicker.onSelect(container => {
                    this.executeCommandInternal(screen, namespace, resource, container);
                });
                containerPicker.show();
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

            const resultCallback = (err: any, success: boolean) => {
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
