require("ts-node/register");
// const plugin = require("./plugin/withAppClip").default;
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    // plugin
  ],
});
