import React, { Component } from "react";
import PropTypes from "prop-types";
import "./ChartConfig.css";
import bar from "../assets/bar-chart.svg";
import pie from "../assets/circle-chart.svg";
import line from "../assets/line-chart.svg";
import scatter from "../assets/point-chart.svg";
import ChartDatasetEncoder from "../helpers/ChartDatasetEncoder";
import findIndex from "lodash/findIndex";

const chartIcons = {
    bar,
    pie,
    line,
    scatter
};

export default class ChartConfig extends Component {
    renderDropdownSelect(options, id, label) {
        return (
            <div>
                <label htmlFor={label}>{label}</label>
                <select
                    className="au-select"
                    name="input"
                    label={label}
                    id={label}
                    value={findIndex(options, item => item === this.props[id])}
                    onChange={e => {
                        const idx = e.target.value;
                        this.onChange(id, options[idx]);
                    }}
                >
                    {options
                        ? options.map(
                              (o, idx) =>
                                  typeof o === "string" ? (
                                      <option key={o} value={o} label={o}>
                                          {o}
                                      </option>
                                  ) : (
                                      <option
                                          key={idx}
                                          value={idx}
                                          label={o.label}
                                      >
                                          {o.label}
                                      </option>
                                  )
                          )
                        : null}
                </select>
            </div>
        );
    }

    renderIconSelect() {
        return (
            <div className="chart-config_icon-select">
                <label tabIndex="-1">Chart type</label>
                {ChartDatasetEncoder.avlChartTypes.map(v => (
                    <button
                        className={this.props.chartType === v ? "isActive" : ""}
                        onClick={e => this.onChange("chartType", v)}
                        key={v}
                        title={v}
                    >
                        <img alt={v} src={chartIcons[v]} />
                    </button>
                ))}
            </div>
        );
    }

    onChange(id, value) {
        this.props.onChange(id, value);
    }

    render() {
        return (
            <div className="chart-config">
                <div className="chart-type">{this.renderIconSelect()}</div>
                <div className="chart-title">
                    <label htmlFor="chart-title">chart title</label>
                    <input
                        className="au-text-input"
                        name="text-input"
                        id="chart-title"
                        type="text"
                        onChange={e =>
                            this.onChange("chartTitle", e.target.value)
                        }
                        label="Chart title"
                        placeholder="Enter a descriptive chart title"
                        value={this.props.chartTitle}
                    />
                </div>
                <div className="y-axis">
                    {this.renderDropdownSelect(
                        this.props.xAxisOptions,
                        "xAxis",
                        "xAxis"
                    )}
                </div>
                <div className="x-axis">
                    {this.renderDropdownSelect(
                        this.props.yAxisOptions,
                        "yAxis",
                        "yAxis"
                    )}
                </div>
            </div>
        );
    }
}

ChartConfig.propTypes = {
    chartTitle: PropTypes.string,
    chartType: PropTypes.oneOf(ChartDatasetEncoder.avlChartTypes),
    onChange: PropTypes.func,
    xAxis: PropTypes.object,
    xAxisOptions: PropTypes.arrayOf(PropTypes.object),
    yAxis: PropTypes.object,
    yAxisOptions: PropTypes.arrayOf(PropTypes.object)
};
