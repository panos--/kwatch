import { Action } from "./action";
import { APIResource } from "../client";
import { V1Namespace } from "@kubernetes/client-node";
import { ContainerPicker } from "../widgets/container_picker";
import { BlessedUtils } from "../blessed_utils";
import { AppContext } from "../app_context";

export class TailLogAction implements Action {
    public getLabel() {
        return "Tail logs";
    }

    public appliesTo(apiResource: APIResource) {
        return apiResource.resource.name == "pods";
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getPod(resource, namespace.metadata.name).then(pod => {
            let containers = pod.spec.containers.map(container => { return container.name; });
            if (containers.length == 0) {
                // should not happen
                throw "no containers found in pod";
            }
            else if (containers.length == 1) {
                this.executeCommand(ctx, namespace, resource, containers[0]);
            }
            else {
                const containerPicker = new ContainerPicker(ctx, containers, ctx.screen);
                containerPicker.onSelect(container => {
                    this.executeCommand(ctx, namespace, resource, container);
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

    private executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string) {
        BlessedUtils.executeCommand(ctx.screen, "kubectl", [
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
