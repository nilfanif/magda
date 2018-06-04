import React, { Component } from "react";
import { Medium } from "./Responsive";
import Spinner from "../Components/Spinner";
import ChartDatasetEncoder from "../helpers/ChartDatasetEncoder";
import ChartConfig from "./ChartConfig";
import "./DataPreviewChart.css";

let ReactEcharts = null;

const defaultChartType = "bar";

class DataPreviewChart extends Component {
    constructor(props) {
        super(props);
        this.state = this.getResetState({
            chartType: defaultChartType,
            isLoading: true,
            chartTitle: this.props.distribution.title
                ? this.props.distribution.title
                : ""
        });
        this.chartDatasetEncoder = null;
        this.onChartConfigChanged = this.onChartConfigChanged.bind(this);
    }

    getResetState(extraOptions = null) {
        const options = {
            error: null,
            isLoading: false,
            avlXCols: [],
            avlYCols: [],
            xAxis: null,
            yAxis: null,
            chartOption: null
        };
        if (!extraOptions) return options;
        else return { ...options, ...extraOptions };
    }

    async initChartData() {
        try {
            if (
                ChartDatasetEncoder.isValidDistributionData(
                    this.props.distribution
                )
            ) {
                if (!this.chartDatasetEncoder)
                    this.chartDatasetEncoder = new ChartDatasetEncoder(
                        this.props.distribution
                    );
                else this.chartDatasetEncoder.init(this.props.distribution);
                if (!this.chartDatasetEncoder.isDataLoaded)
                    await this.chartDatasetEncoder.loadData();

                let chartType = this.state.chartType;
                if (!this.state.xAxis || !this.state.yAxis) {
                    this.chartDatasetEncoder.setDefaultParameters();
                    //if(this.chartDatasetEncoder.yAxis.isAggr) chartType = "pie";
                    // will not set to pie by default
                } else {
                    this.chartDatasetEncoder.setX(this.state.xAxis);
                    this.chartDatasetEncoder.setY(this.state.yAxis);
                }

                if (!chartType) chartType = defaultChartType;
                this.chartDatasetEncoder.setChartType(chartType);
                const chartOption = this.chartDatasetEncoder.getChartOption(
                    this.state.chartTitle
                );

                this.setState({
                    error: null,
                    isLoading: false,
                    avlXCols: this.chartDatasetEncoder.getAvailableXCols(),
                    avlYCols: this.chartDatasetEncoder.getAvailableYCols(),
                    xAxis: this.chartDatasetEncoder.xAxis,
                    yAxis: this.chartDatasetEncoder.yAxis,
                    chartType,
                    chartOption
                });
                if (console && console.log) console.log(chartOption);
            }
        } catch (e) {
            console.log(e);
            throw e; //--- not capture here; only for debug
        }
    }

    async componentDidMount() {
        try {
            if (!ReactEcharts)
                ReactEcharts = (await import("echarts-for-react")).default;
            await this.initChartData();
        } catch (e) {
            console.log(
                this.getResetState({
                    error: e
                })
            );
            this.setState(
                this.getResetState({
                    error: e
                })
            );
        }
    }

    async componentDidUpdate(prevProps, prevState) {
        try {
            if (
                ChartDatasetEncoder.isValidDistributionData(
                    this.props.distribution
                ) &&
                (prevProps.distribution.identifier !==
                    this.props.distribution.identifier ||
                    prevState.chartTitle !== this.state.chartTitle ||
                    prevState.chartType !== this.state.chartType ||
                    prevState.xAxis !== this.state.xAxis ||
                    prevState.yAxis !== this.state.yAxis)
            ) {
                this.setState(
                    this.getResetState({
                        isLoading: true
                    })
                );
                await this.initChartData();
            }
        } catch (e) {
            console.log(
                this.getResetState({
                    error: e
                })
            );
            this.setState(
                this.getResetState({
                    error: e
                })
            );
        }
    }

    onChartConfigChanged(key, value) {
        this.setState({ [key]: value });
    }

    render() {
        if (this.state.error)
            return (
                <div className="error">
                    <h3>{this.state.error.name}</h3>
                    {this.state.error.message}
                </div>
            );
        if (this.state.isLoading) return <Spinner height="420px" />;
        if (!ReactEcharts)
            return <div>Unexpected Error: failed to load chart component.</div>;

        return (
            <div
                className="row data-preview-chart"
                ref={chartWidthDiv => {
                    this.chartWidthDiv = chartWidthDiv;
                }}
            >
                <div className="col-md-8">
                    <ReactEcharts
                        className="data-preview-chart-container"
                        style={{ height: "450px", color: "yellow" }}
                        lazyUpdate={true}
                        option={this.state.chartOption}
                        theme="au_dga"
                    />
                </div>
                <Medium>
                    <div className="col-md-4 config-panel-container">
                        <ChartConfig
                            chartType={this.state.chartType}
                            chartTitle={this.state.chartTitle}
                            xAxis={this.state.xAxis}
                            yAxis={this.state.yAxis}
                            xAxisOptions={this.state.avlXCols}
                            yAxisOptions={this.state.avlYCols}
                            onChange={this.onChartConfigChanged}
                        />
                    </div>
                </Medium>
            </div>
        );
    }
}

export default DataPreviewChart;
