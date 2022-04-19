import { ConfigPlugin, withXcodeProject } from "@expo/config-plugins";

import {
  addBuildSourceFileToGroup,
  addResourceFileToGroup,
} from "./config-plugins-fork";
import {
  addStickersTarget,
  getMainPBXGroup,
  pushFile,
  pushInfoPlist,
} from "./xcodeSticker";

export function getProjectStickersName(name: string) {
  return `${name} Clip`;
}

export const withAppClipXcodeTarget: ConfigPlugin<{ name: string }> = (
  config,
  { name }
) => {
  return withXcodeProject(config, (config) => {
    const target = addStickersTarget(
      config.modResults,
      name,
      config.ios!.bundleIdentifier!,
      name
    );

    // create stickers group
    const groupId = config.modResults.pbxCreateGroup(
      // Without quotes, this breaks the xcode project
      `"${name}"`,
      `"${name}"`
    );

    const mainGroup = getMainPBXGroup(config.modResults);

    if (mainGroup) {
      config.modResults.addToPbxGroup(groupId, mainGroup.id);

      const groupName = `"${name}"`;

      ["AppDelegate.m", "main.m"].forEach((filepath) =>
        addBuildSourceFileToGroup({
          filepath,
          groupName,
          project: config.modResults,
          targetUuid: target.uuid,
        })
      );

      ["Images.xcassets", "Base.lproj/SplashScreen.storyboard"].forEach(
        (filepath) =>
          addResourceFileToGroup({
            filepath,
            groupName,
            isBuildFile: true,
            project: config.modResults,
            targetUuid: target.uuid,
          })
      );

      ["AppDelegate.h", "app.entitlements", "Info.plist"].forEach(
        (filepath) => {
          pushFile(config.modResults, filepath, groupId, name);
        }
      );
    }

    return config;
  });
};
