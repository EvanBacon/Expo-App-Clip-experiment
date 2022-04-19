import {
  ConfigPlugin,
  IOSConfig,
  withDangerousMod,
} from "@expo/config-plugins";
import { mergeContents } from "@expo/config-plugins/build/utils/generateCode";
import fs from "fs-extra";
import { sync as globSync } from "glob";
import path from "path";
import { withIosAccentColor } from "./withAccentColor";

import { withAppClipXcodeTarget } from "./withAppClipXcodeTarget";
import {
  withAppClipEntitlements,
  withAppClipEntitlementsBaseMod,
} from "./withEntitlementsBaseMod";
import {
  withAppClipInfoPlist,
  withAppClipInfoPlistBaseMod,
} from "./withInfoPlistBaseMod";
import { withIosIcons } from "./withIosIcons";

function getClips(projectRoot: string): string[] {
  const entryFiles = globSync("pages/**/*.clip.@(js|jsx|ts|tsx)", {
    absolute: true,
    cwd: projectRoot,
  });
  return entryFiles;
}

const withNamedAppClip: ConfigPlugin<{
  name: string;
  icon: string;
  accentColor: string;
  bundleIdentifierSuffix?: string;
}> = (
  config,
  {
    name,
    icon,
    // TODO
    accentColor,
    bundleIdentifierSuffix,
  }
) => {
  const xcodeProjectName = IOSConfig.XcodeUtils.sanitizedName(name);

  if (!bundleIdentifierSuffix) {
    bundleIdentifierSuffix = ["Clip", xcodeProjectName.replace(" ", "")].join(
      "."
    );
  }

  config = withIosIcons(config, {
    projectName: xcodeProjectName,
    // TODO: Get from clip file or config
    iconFilePath: icon,
  });

  config = withIosAccentColor(config, {
    projectName: xcodeProjectName,
    color: accentColor,
  });

  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const templatePath = path.join(__dirname, "template/ios");
      const iosProjectPath = path.join(
        config.modRequest.platformProjectRoot,
        xcodeProjectName
      );
      console.log("copying template to ", iosProjectPath);

      await fs.ensureDir(iosProjectPath);
      await fs.copy(templatePath, iosProjectPath, {
        overwrite: true,
      });

      return config;
    },
  ]);

  config = withAppClipXcodeTarget(config, {
    name: xcodeProjectName,
  });

  config = withAppClipEntitlements(config, (config) => {
    config.modResults["com.apple.developer.parent-application-identifiers"] = [
      "$(AppIdentifierPrefix)$(CFBundleIdentifier)",
    ];
    // TODO: other stuff ig...
    return config;
  });

  config = withAppClipInfoPlist(config, (config) => {
    // config.modResults = {
    //   CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    //   // CFBundleExecutable: xcodeProjectName,
    //   CFBundleExecutable: "$(EXECUTABLE_NAME)",
    //   CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    //   CFBundleName: "$(PRODUCT_NAME)",
    //   CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    //   CFBundleInfoDictionaryVersion: "6.0",
    //   CFBundleSignature: "????",
    //   ...config.modResults,
    // };
    config.modResults.CFBundleDisplayName = name;
    config.modResults.CFBundleVersion = IOSConfig.Version.getVersion(config);
    // config.modResults.CFBundleExecutable = IOSConfig.Version.getVersion(config);
    config.modResults.CFBundleShortVersionString =
      IOSConfig.Version.getBuildNumber(config);
    config.modResults.CFBundleIdentifier =
      IOSConfig.BundleIdentifier.getBundleIdentifier(config) +
      "." +
      bundleIdentifierSuffix;
    return config;
  });
  config = withCocoaPodsAppClipTargets(config, { name: xcodeProjectName });

  // Must come after all other mods that utilize the sticker pack info plist mod.
  config = withAppClipInfoPlistBaseMod(config, { name: xcodeProjectName });
  config = withAppClipEntitlementsBaseMod(config, {
    targetName: xcodeProjectName,
  });

  return config;
};

const withCocoaPodsAppClipTargets: ConfigPlugin<{ name: string }> = (
  c,
  { name }
) => {
  return withDangerousMod(c, [
    "ios",
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, "Podfile");

      const contents = await fs.promises.readFile(file, "utf8");

      await fs.promises.writeFile(file, addBlock(contents, name), "utf-8");
      return config;
    },
  ]);
};

export function addBlock(src: string, name: string): string {
  return mergeContents({
    tag: "app-clips",
    src,
    newSrc: [`  target '${name}' do`, `    inherit! :complete`, "  end"].join(
      "\n"
    ),
    anchor: /use_react_native/,
    // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
    offset: 0,
    comment: "#",
  }).contents;
}

const withAppClip: ConfigPlugin = (config) => {
  config = withNamedAppClip(config, {
    name: "yolo86 Clip",
    accentColor: "#4630eb",
    icon: "https://icogen.vercel.app/api/icon",
    // icon: require.resolve("../assets/icon.png"),
  });
  return config;
};

export default withAppClip;
