import { Action } from "./action";
import { APIResource, K8sClient } from "../client";
import * as blessed from "blessed";
import { V1Namespace } from "@kubernetes/client-node";
import { ContainerPicker } from "../widgets/container_picker";
import { BlessedUtils } from "../blessed_utils";

export class TailLogAction implements Action {
    public getLabel() {
        return "Tail logs";
    }

    public appliesTo(apiResource: APIResource) {
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
                this.executeCommand(screen, namespace, resource, containers[0]);
            }
            else {
                const containerPicker = new ContainerPicker(containers, screen);
                containerPicker.onSelect(container => {
                    this.executeCommand(screen, namespace, resource, container);
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
    };

    private executeCommand(screen: blessed.Widgets.Screen, namespace: V1Namespace, resource: string, container: string) {
        BlessedUtils.executeCommand(screen, "kubectl", [
            "-n",
            namespace.metadata.name,
            "logs",
            "--tail=100",
            "-f",
            "-c",
            container,
            resource
        ], (err: any, success: boolean) => {
            if (err) {
                console.log(err);
            }
            if (!success) {
                console.log("Command returned with non-zero exit code");
            }
        });
    }
}
