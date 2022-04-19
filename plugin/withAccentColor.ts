import { ConfigPlugin, withDangerousMod } from "@expo/config-plugins";
import { ContentsJsonImageIdiom } from "@expo/prebuild-config/build/plugins/icons/AssetContents";
import * as fs from "fs-extra";
import path, { join } from "path";

export const withIosAccentColor: ConfigPlugin<{
  projectName: string;
  color: string;
}> = (config, { projectName, color }) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      await setColorAsync(
        color,
        join(config.modRequest.platformProjectRoot, projectName)
      );
      return config;
    },
  ]);
};

const IMAGESET_PATH = "Images.xcassets/AccentColor.colorset";

export async function setColorAsync(
  color: string,
  iosNamedProjectRoot: string
) {
  // Ensure the Images.xcassets/AppIcon.appiconset path exists
  await fs.ensureDir(join(iosNamedProjectRoot, IMAGESET_PATH));

  // Store the image JSON data for assigning via the Contents.json
  const colorsJson: {
    color: {
      "color-space": "srgb";
      components: {
        alpha: string;
        blue: string;
        green: string;
        red: string;
      };
    };
    idiom: ContentsJsonImageIdiom;
  }[] = [];

  const [red, green, blue] = getRGB(color);
  colorsJson.push({
    color: {
      "color-space": "srgb",
      components: {
        alpha: "1.0",
        red,
        green,
        blue,
      },
    },
    idiom: "universal",
  });

  // Finally, write the Config.json
  await writeContentsJsonAsync(join(iosNamedProjectRoot, IMAGESET_PATH), {
    colors: colorsJson,
  });
}
function getRGB(hexVal) {
  var commaSeperated = "";

  // Removes the first character from the input string
  hexVal = hexVal.substring(1, hexVal.length);

  // Now let's separate the pairs by a comma
  for (var i = 0; i < hexVal.length; i++) {
    // Iterate through each char of hexVal

    // Copy each char of hexVal to commaSeperated
    commaSeperated += hexVal.charAt(i);

    // After each pair of characters add a comma, unless this
    // is the last char
    commaSeperated += i % 2 == 1 && i != hexVal.length - 1 ? "," : "";
  }
  // split the commaSeperated string by commas and return the array
  return commaSeperated.split(",");
}

function getAppleIconName(size: number, scale: number): string {
  return `App-Icon-${size}x${size}@${scale}x.png`;
}

async function writeContentsJsonAsync(directory, { colors }) {
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(
    path.join(directory, "Contents.json"),
    JSON.stringify(
      {
        colors,
        info: {
          version: 1,
          // common practice is for the tool that generated the icons to be the "author"
          author: "expo",
        },
      },
      null,
      2
    )
  );
}
