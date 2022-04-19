import {
  BaseMods,
  ConfigPlugin,
  InfoPlist,
  IOSConfig,
  Mod,
  ModProps,
  WarningAggregator,
  withMod,
} from "@expo/config-plugins";
import plist from "@expo/plist";
import * as fs from "fs";
import * as path from "path";

import { getCustomTargetInfoPlistReference } from "./xcodeSticker";

// import xcode from "xcode";

const customModName = "clipEntitlements";

/**
 * Provides the Stickers target Info.plist  file for modification.
 *
 * @param config
 * @param action
 */
export const withAppClipEntitlements: ConfigPlugin<Mod<InfoPlist>> = (
  config,
  action
) => {
  return withMod(config, {
    platform: "ios",
    mod: customModName,
    action,
  });
};

export const withAppClipEntitlementsBaseMod: ConfigPlugin<{
  targetName: string;
}> = (config, { targetName }) => {
  return withCustomTargetEntitlementsBaseMod(config, {
    modName: customModName,
    productType: "com.apple.product-type.application.on-demand-install-capable",
    getFallbackFilePath({ platformProjectRoot }) {
      return path.join(platformProjectRoot, targetName, "app.entitlements");
    },
    template: {
      "com.apple.developer.parent-application-identifiers": [],
    },
  });
};

export const withCustomTargetEntitlementsBaseMod: ConfigPlugin<{
  /** Template file contents to use when no file can be found. */
  template: InfoPlist;
  /** Name of the mod to append: `mods.ios.<modName>` */
  modName: string;
  /** The iOS target product type. @example `'com.apple.product-type.app-extension.messages-sticker-pack'` */
  productType: string;
  /** Returns the fallback file path name. This is an invalid property for a config plugin since it cannot be serialized. */
  getFallbackFilePath: (modRequest: ModProps<InfoPlist>) => string;
}> = (config, { template, modName, productType, getFallbackFilePath }) => {
  return BaseMods.withGeneratedBaseMods(config, {
    platform: "ios",
    saveToInternal: true,
    skipEmptyMod: false,
    providers: {
      // Append a custom rule to supply AppDelegate header data to mods on `mods.ios.AppClipInfoPlist`
      [modName]: BaseMods.provider<InfoPlist>({
        isIntrospective: true,
        async getFilePath({ modRequest }) {
          let project: any | null = null;
          // let project: xcode.XcodeProject | null = null;
          try {
            project = IOSConfig.XcodeUtils.getPbxproj(modRequest.projectRoot);
          } catch {
            // noop
          }

          // Only check / warn if a project actually exists, this'll provide
          // more accurate warning messages for users in managed projects.
          if (project) {
            const buildProperty = getCustomTargetInfoPlistReference(project, {
              productType,
              field: "CODE_SIGN_ENTITLEMENTS",
            });
            // console.log("Got infoPlist property", infoPlistBuildProperty);
            if (buildProperty) {
              //: [root]/myapp/ios/MyApp/Info.plist
              const infoPlistPath = path.join(
                //: myapp/ios
                modRequest.platformProjectRoot,
                //: MyApp/Info.plist
                buildProperty
              );
              return infoPlistPath;
            } else {
              WarningAggregator.addWarningIOS(
                `mods.ios.${modName}`,
                "Failed to find app.entitlements linked to Xcode project."
              );
            }
          }
          return getFallbackFilePath(modRequest);
        },
        async read(filePath) {
          try {
            return plist.parse(await fs.promises.readFile(filePath, "utf8"));
          } catch (error) {
            return template;
          }
        },
        async write(filePath, { modResults, modRequest: { introspect } }) {
          if (introspect) {
            return;
          }
          await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
          await fs.promises.writeFile(filePath, plist.build(modResults));
        },
      }),
    },
  });
};
