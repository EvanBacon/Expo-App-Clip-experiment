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

const customModName = "clipInfoPlist";

/**
 * Provides the Stickers target Info.plist  file for modification.
 *
 * @param config
 * @param action
 */
export const withAppClipInfoPlist: ConfigPlugin<Mod<InfoPlist>> = (
  config,
  action
) => {
  return withMod(config, {
    platform: "ios",
    mod: customModName,
    action,
  });
};

export const withAppClipInfoPlistBaseMod: ConfigPlugin<{ name: string }> = (
  config,
  { name }
) => {
  return withCustomTargetInfoPlistBaseMod(config, {
    modName: customModName,
    productType: "com.apple.product-type.application.on-demand-install-capable",
    getFallbackFilePath({ projectName, platformProjectRoot }) {
      const stickerPackName = name; // getProjectStickersName(projectName!);
      const stickerRootPath = path.join(platformProjectRoot, stickerPackName);
      const filePath = path.join(stickerRootPath, "Info.plist");
      return filePath;
    },
    template: {
      CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
      CFBundleExecutable: "$(EXECUTABLE_NAME)",
      CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
      CFBundleName: "$(PRODUCT_NAME)",
      CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
      CFBundleInfoDictionaryVersion: "6.0",
      CFBundleSignature: "????",
      LSRequiresIPhoneOS: true,

      CFBundleDisplayName: "name",

      UIApplicationSupportsIndirectInputEvents: true,

      NSAppClip: {
        NSAppClipRequestEphemeralUserNotification: false,
        NSAppClipRequestLocationConfirmation: false,
      },
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
      UILaunchStoryboardName: "SplashScreen",
      UIViewControllerBasedStatusBarAppearance: false,
      UIStatusBarStyle: "UIStatusBarStyleDefault",
      UISupportedInterfaceOrientations: [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
      ],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
    },
  });
};

export const withCustomTargetInfoPlistBaseMod: ConfigPlugin<{
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
            const infoPlistBuildProperty = getCustomTargetInfoPlistReference(
              project,
              { productType }
            );
            // console.log("Got infoPlist property", infoPlistBuildProperty);
            if (infoPlistBuildProperty) {
              //: [root]/myapp/ios/MyApp/Info.plist
              const infoPlistPath = path.join(
                //: myapp/ios
                modRequest.platformProjectRoot,
                //: MyApp/Info.plist
                infoPlistBuildProperty
              );
              return infoPlistPath;
            } else {
              WarningAggregator.addWarningIOS(
                `mods.ios.${modName}`,
                "Failed to find Info.plist linked to Xcode project."
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
          await fs.promises.writeFile(filePath, plist.build(modResults));
        },
      }),
    },
  });
};
