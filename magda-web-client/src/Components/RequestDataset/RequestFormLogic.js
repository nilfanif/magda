import React from "react";
import RequestFormTemplate from "./RequestFormTemplate";
import Alert from "./Alert";
import { correspondenceApiUrl, correspondenceApiReportUrl } from "../../config";

export default class RequestFormLogic extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            successResult: false,
            posted: false,
            isSending: false,
            senderEmail: "",
            message: "",
            senderName: ""
        };
    }

    /**
     * This handles the change event of typing into the form.
     * It passes the state value of email, name and message.
     * When called in the parent component,
     * it also helps retain the state when the form is not submited, or an error state has occured.
     */
    handleChange = data => {
        this.props.handleChange(data, this.state.successResult);
    };

    /**
     * handles the logic of submitting form
     * @param {Object} data form submitted data from child component "RequestFormTemplate.js"
     */
    handleSubmit = data => {
        this.setState(() => {
            return {
                isSending: true
            };
        });
        const senderEmail = data.senderEmail;
        const message = data.message;
        const senderName = data.senderName;
        var url = "";
        //check to see the type of request. This will change the api url accordingly
        if (this.props.requestType === "request") {
            url = correspondenceApiUrl;
        } else {
            url = correspondenceApiReportUrl.replace(
                ":datasetId",
                this.props.datasetId
            );
        }
        fetch(url, {
            method: "POST",
            headers: {
                "Content-type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message,
                senderEmail,
                senderName
            })
        })
            .then(response => {
                if (!response.ok) {
                    this.setState(() => {
                        return {
                            successResult: false,
                            posted: true,
                            isSending: false
                        };
                    });
                    if (this.props.formSubmitState) {
                        this.props.formSubmitState(true);
                    }
                } else {
                    this.setState(() => {
                        return {
                            successResult: true,
                            posted: true,
                            isSending: false
                        };
                    });
                    this.handleChange(data);
                    if (this.props.formSubmitState) {
                        this.props.formSubmitState(true);
                    }
                }
            })
            .catch(error => {
                this.setState(() => {
                    return {
                        successResult: false,
                        posted: true,
                        isSending: false
                    };
                });
            });
    };

    /**
     * Render logic of the page.
     * Shows the form or alert dependent on the "posted" state
     * Shows success or fail alert dependent on "successResult" state,
     * which is received from calling API
     */
    renderPage() {
        const alert = {
            type: this.state.successResult ? "success" : "error",
            message: this.state.successResult
                ? this.props.alertProps.successMessage
                : this.props.alertProps.failMessage,
            header: this.state.successResult
                ? this.props.alertProps.successHeader
                : this.props.alertProps.failHeader
        };
        if (!this.state.posted) {
            return (
                <RequestFormTemplate
                    {...this.props.formProps}
                    handleSubmit={this.handleSubmit}
                    isSending={this.state.isSending}
                    handleChange={this.handleChange}
                    senderEmail={this.props.senderEmail}
                    senderName={this.props.senderName}
                    message={this.props.message}
                />
            );
        } else {
            if (this.state.successResult) {
                return (
                    <Alert
                        type={alert.type}
                        header={alert.header}
                        message={alert.message}
                    />
                );
            } else {
                return (
                    <div>
                        {!this.state.isSending && (
                            <Alert
                                type={alert.type}
                                message={alert.message}
                                header={alert.header}
                            />
                        )}
                        <RequestFormTemplate
                            {...this.props.formProps}
                            handleSubmit={this.handleSubmit}
                            handleChange={this.handleChange}
                            isSending={this.state.isSending}
                            senderEmail={this.props.senderEmail}
                            senderName={this.props.senderName}
                            message={this.props.message}
                        />
                    </div>
                );
            }
        }
    }

    render() {
        return this.renderPage();
    }
}
