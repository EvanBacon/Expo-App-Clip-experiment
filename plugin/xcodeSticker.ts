import { XcodeProject, IOSConfig } from "@expo/config-plugins";
import path from "path";
import util from "util";
// @ts-ignore
import pbxFile from "xcode/lib/pbxFile";

const debug = require("debug")(
  "expo:config-plugins:ios-stickers:xcode"
) as typeof console.log;

export function getMainPBXGroup(proj: XcodeProject) {
  const project = proj.pbxProjectSection()[proj.getFirstProject().uuid];

  if (!project || !project.mainGroup) {
    return null;
  }

  const groupObj = proj.hash.project.objects.PBXGroup[project.mainGroup];
  if (!groupObj) {
    return null;
  }
  return { id: project.mainGroup, obj: groupObj };
}

export function getCustomTargetInfoPlistReference(
  proj: XcodeProject,
  {
    configuration,
    productType,
    field = "INFOPLIST_FILE",
  }: {
    configuration?: "Debug" | "Release";
    productType: string;
    field?: string;
  }
) {
  const stickerTargets = IOSConfig.Target.getNativeTargets(proj).filter(
    ([, target]) => {
      if (!target?.productType) return false;
      return unquote(target.productType) === productType;
    }
  );
  if (!stickerTargets.length) {
    return null;
  }
  const [id, target] = stickerTargets[0];

  // PBXNativeTarget
  const xcConfigurationList =
    proj.hash.project.objects.XCConfigurationList[
      target.buildConfigurationList
    ];

  if (!configuration) {
    // Sometimes this is defined by default as 'Release'.
    configuration = xcConfigurationList.defaultConfigurationName ?? "Debug";
  }

  const buildConfiguration =
    xcConfigurationList.buildConfigurations.find(
      (value: { comment: string; value: string }) =>
        value.comment === configuration
    ) || xcConfigurationList.buildConfigurations[0];

  debug(
    `Get sticker target: (PBXNativeTarget: ${id}, XCConfigurationList: ${target.buildConfigurationList}, XCBuildConfiguration: ${configuration})`
  );

  if (buildConfiguration?.value) {
    const xcBuildConfiguration =
      proj.hash.project.objects.XCBuildConfiguration?.[
        buildConfiguration.value
      ];
    return sanitizeInfoPlistBuildProperty(
      xcBuildConfiguration.buildSettings[field]
    );
  }
  return null;
}

function sanitizeInfoPlistBuildProperty(infoPlist?: string): string | null {
  return infoPlist?.replace(/"/g, "").replace("$(SRCROOT)", "") ?? null;
}

export function addStickerResourceFile(
  proj: XcodeProject,
  path: string,
  rootFolderName: string,
  inPath: string = "Resources"
) {
  const opt: Record<string, any> = {};

  let file = new pbxFile(path, opt);
  if (proj.hasFile(file.path)) {
    return false;
  }

  // @ts-ignore
  file.uuid = proj.generateUuid();
  // @ts-ignore
  file.target = opt ? opt.target : undefined;

  correctForResourcesPath(file, proj, inPath);
  // @ts-ignore
  file.fileRef = proj.generateUuid();

  // create stickers group
  const stickersKey = proj.pbxCreateGroup(
    // Without quotes, this breaks the xcode project
    `"${rootFolderName}"`,
    `"${rootFolderName}"`
  );

  proj.addToPbxBuildFileSection(file); // PBXBuildFile
  // proj.addToPbxResourcesBuildPhase(file); // PBXResourcesBuildPhase
  // ^ the above was written as a shortcut, I guess nobody expected there to be another BuildPhase
  //   var self = proj;
  const addToPbxStickersBuildPhase = function (file: any) {
    // use the name Stickers instead of Resources to identify the new BuildPhase
    const sources = proj.buildPhaseObject(
      "PBXResourcesBuildPhase",
      // "Resources",
      rootFolderName,
      // Resources,
      file.target
    );
    sources.files.push(pbxBuildPhaseObj(file));
  };

  addToPbxStickersBuildPhase(file);

  // PBXFileReference
  proj.addToPbxFileReferenceSection(file);
  proj.addToPbxGroup(file, stickersKey);

  // // Push the Stickers Info.plist
  // file = new pbxFile("Info.plist", opt);
  // if (proj.hasFile(file.path)) {
  //   return false;
  // }
  // // @ts-ignore
  // file.uuid = proj.generateUuid();
  // correctForResourcesPath(file, proj, rootFolderName);
  // // @ts-ignore
  // file.fileRef = proj.generateUuid();
  // // PBXFileReference
  // proj.addToPbxFileReferenceSection(file);
  // proj.addToPbxGroup(file, stickersKey);

  return stickersKey;
}

export function pushInfoPlist(
  proj: XcodeProject,
  groupId: string,
  rootFolderName: string
) {
  const opt: Record<string, any> = {};

  // Push the Stickers Info.plist
  let file = new pbxFile("Info.plist", opt);
  if (proj.hasFile(file.path)) {
    return false;
  }
  // @ts-ignore
  file.uuid = proj.generateUuid();
  correctForResourcesPath(file, proj, rootFolderName);
  // @ts-ignore
  file.fileRef = proj.generateUuid();
  // PBXFileReference
  proj.addToPbxFileReferenceSection(file);
  proj.addToPbxGroup(file, groupId);

  return file;
}

export function pushFile(
  proj: XcodeProject,
  fileName: string,
  groupId: string,
  rootFolderName: string
) {
  const opt: Record<string, any> = {};

  // Push the Stickers Info.plist
  let file = new pbxFile(fileName, opt);
  if (proj.hasFile(file.path)) {
    return false;
  }
  // @ts-ignore
  file.uuid = proj.generateUuid();
  correctForResourcesPath(file, proj, rootFolderName);
  // @ts-ignore
  file.fileRef = proj.generateUuid();
  // PBXFileReference
  proj.addToPbxFileReferenceSection(file);
  proj.addToPbxGroup(file, groupId);

  return file;
}

const isaXCBuildConfiguration = "XCBuildConfiguration";
const pbxTargetDependency = "PBXTargetDependency";
const pbxContainerItemProxy = "PBXContainerItemProxy";

export function addStickersTarget(
  proj: XcodeProject,
  name: string,
  bundleId: string,
  subfolder: string
) {
  // Setup uuid and name of new target
  let targetUuid = proj.generateUuid();
  let targetType = "app_clip";
  let targetName = name.trim();
  const bundleName = subfolder.trim().split(" ").join("-");

  // Check type against list of allowed target types
  if (!targetName) {
    throw new Error("Target name missing.");
  }

  // Check type against list of allowed target types
  if (!targetType) {
    throw new Error("Target type missing.");
  }

  // Check type against list of allowed target types
  if (!producttypeForTargettype(targetType)) {
    throw new Error("Target type invalid: " + targetType);
  }

  const PRODUCT_BUNDLE_IDENTIFIER = `"${bundleId}.${bundleName}"`;
  const INFOPLIST_FILE = `"${subfolder}/Info.plist"`;
  const CODE_SIGN_ENTITLEMENTS = `"${subfolder}/${subfolder}.entitlements"`;
  console.log("signing", CODE_SIGN_ENTITLEMENTS, subfolder);
  const commonBuildSettings = {
    INFOPLIST_FILE,
    PRODUCT_BUNDLE_IDENTIFIER,
    ASSETCATALOG_COMPILER_APPICON_NAME: `"AppIcon"`,
    ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: "AccentColor",
    CLANG_ANALYZER_NONNULL: "YES",
    CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: "YES_AGGRESSIVE",
    CLANG_CXX_LANGUAGE_STANDARD: `"gnu++17"`,
    CLANG_ENABLE_OBJC_WEAK: "YES",
    CLANG_WARN_DOCUMENTATION_COMMENTS: "YES",
    CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: "YES",
    CLANG_WARN_UNGUARDED_AVAILABILITY: "YES_AGGRESSIVE",
    CODE_SIGN_ENTITLEMENTS,
    CODE_SIGN_STYLE: "Automatic",
    CURRENT_PROJECT_VERSION: 1,
    DEBUG_INFORMATION_FORMAT: "dwarf",
    SWIFT_VERSION: "5.0",
    GCC_C_LANGUAGE_STANDARD: "gnu11",
    // GENERATE_INFOPLIST_FILE: 'YES',
    // INFOPLIST_FILE: 'yolo85Clip/Info.plist',
    IPHONEOS_DEPLOYMENT_TARGET: "15.4",
    LD_RUNPATH_SEARCH_PATHS: `"$(inherited) @executable_path/Frameworks"`,
    MARKETING_VERSION: "1.0",
    MTL_ENABLE_DEBUG_INFO: "INCLUDE_SOURCE",
    MTL_FAST_MATH: "YES",
    PRODUCT_NAME: `"$(TARGET_NAME)"`,
    SWIFT_EMIT_LOC_STRINGS: "YES",
    TARGETED_DEVICE_FAMILY: `"1,2"`,
  };
  // Build Configuration: Create
  const buildConfigurationsList = [
    {
      name: "Debug",
      isa: isaXCBuildConfiguration,
      buildSettings: {
        ...commonBuildSettings,
        // MTL_ENABLE_DEBUG_INFO: "INCLUDE_SOURCE",
      },
    },
    {
      name: "Release",
      isa: isaXCBuildConfiguration,
      buildSettings: {
        ...commonBuildSettings,
        COPY_PHASE_STRIP: "NO",
        DEBUG_INFORMATION_FORMAT: `"dwarf-with-dsym"`,
        GCC_C_LANGUAGE_STANDARD: "gnu11",
      },
    },
  ];

  // Build Configuration: Add
  const buildConfigurations = proj.addXCConfigurationList(
    buildConfigurationsList,
    "Release",
    `Build configuration list for PBXNativeTarget ${quoted(targetName)} `
  );

  // Product: Create
  const productName = targetName;
  const productType = producttypeForTargettype(targetType);
  const productFileType = filetypeForProducttype(productType);
  const productFile = proj.addProductFile(productName, {
    group: "Embed App Clips",
    target: targetUuid,
    explicitFileType: productFileType,
  });

  // stickers
  productFile.settings = productFile.settings || {};
  productFile.settings.ATTRIBUTES = ["RemoveHeadersOnCopy"];

  // Product: Add to build file list
  proj.addToPbxBuildFileSection(productFile);

  const strippedTargetName = path.basename(targetName, ".app").trim();
  const quotedTargetName = quoted(strippedTargetName);

  // proj.addTo
  // PBXFrameworksBuildPhase

  // Target: Create
  const target = {
    uuid: targetUuid,
    pbxNativeTarget: {
      isa: "PBXNativeTarget",
      name: quotedTargetName,
      productName: quotedTargetName,
      productReference: productFile.fileRef,
      productType: quoted(producttypeForTargettype(targetType)),
      buildConfigurationList: buildConfigurations.uuid,
      buildPhases: [
        // ... TODO
        // 7C5ECA4F824E82F9358CCCAA /* [CP] Check Pods Manifest.lock */,
        // CD300D0B280F18F400B19F11 /* Sources */,
        // CD300D0C280F18F400B19F11 /* Frameworks */,
        // CD300D0D280F18F400B19F11 /* Resources */,
        // 7C57EA75282BCB713689CF49 /* [CP] Copy Pods Resources */,
      ],
      buildRules: [],
      dependencies: [],
    },
  };

  // Target: Add to PBXNativeTarget section
  proj.addToPbxNativeTargetSection(target);

  // Add build phases to the new target
  proj.addBuildPhase(
    [
      // "AppDelegate.m", "main.m", "ExpoModulesProvider.swift"
    ],
    "PBXSourcesBuildPhase",
    "Sources",
    target.uuid
  );

  // Frameworks

  proj.addBuildPhase(
    [
      // libPods-yolo85-yolo85Clip.a in Frameworks -- added by running pod install
    ],
    "PBXFrameworksBuildPhase",
    "Frameworks",
    target.uuid
  );

  proj.addBuildPhase(
    [
      // "SplashScreen.storyboard", "Images.xcassets"
    ],
    "PBXResourcesBuildPhase",
    "Resources",
    target.uuid
  );

  // Product: Embed (only for "extension"-type targets)
  // Create CopyFiles phase in first target
  const { buildPhase } = proj.addBuildPhase(
    [],
    "PBXCopyFilesBuildPhase",
    "Embed App Clips",
    proj.getFirstTarget().uuid,
    // targetType,
    "app_extension"
  );

  buildPhase.dstSubfolderSpec = 16;
  buildPhase.dstPath = `"$(CONTENTS_FOLDER_PATH)/AppClips"`;
  buildPhase.runOnlyForDeploymentPostprocessing = 0;

  addToPbxCopyfilesBuildPhase(proj, productFile, "Embed App Clips");

  // need to add another buildphase
  // filePathsArray, buildPhaseType, comment, target
  // proj.addBuildPhase([], "PBXResourcesBuildPhase", subfolder, targetUuid);

  // Target: Add uuid to root project
  proj.addToPbxProjectSection(target);

  // const pbxTargetDependencySection = proj.hash.project.objects[pbxTargetDependency];
  // These need to be defined in projects that don't have them already
  if (!proj.hash.project.objects[pbxTargetDependency]) {
    proj.hash.project.objects[pbxTargetDependency] = {};
  }
  if (!proj.hash.project.objects[pbxContainerItemProxy]) {
    proj.hash.project.objects[pbxContainerItemProxy] = {};
  }

  proj.addTargetDependency(proj.getFirstTarget().uuid, [target.uuid]);

  // Set the creation tools and provisioning....
  if (
    !proj.pbxProjectSection()[proj.getFirstProject().uuid].attributes
      .TargetAttributes
  ) {
    proj.pbxProjectSection()[
      proj.getFirstProject().uuid
    ].attributes.TargetAttributes = {};
  }
  proj.pbxProjectSection()[
    proj.getFirstProject().uuid
  ].attributes.TargetAttributes[target.uuid] = {
    CreatedOnToolsVersion: "13.3",
    ProvisioningStyle: "Automatic",
  };

  return target;
}

type PBXFile = any;

// Copied over from xcode package for public

function correctForResourcesPath(
  file: PBXFile,
  project: XcodeProject,
  name: string = "Resources"
) {
  return correctForPath(file, project, name);
}

function correctForPath(file: PBXFile, project: XcodeProject, group: string) {
  const r_group_dir = new RegExp("^" + group + "[\\\\/]");

  const _group = project.pbxGroupByName(group);
  if (_group && _group.path) {
    file.path = file.path.replace(r_group_dir, "");
  }

  return file;
}

function addToPbxCopyfilesBuildPhase(
  proj: XcodeProject,
  file: PBXFile,
  name: string
) {
  const sources = proj.buildPhaseObject(
    "PBXCopyFilesBuildPhase",
    name || "Copy Files",
    file.target
  );
  sources.files.push(pbxBuildPhaseObj(file));
}

function producttypeForTargettype(targetType: string): string {
  const PRODUCTTYPE_BY_TARGETTYPE: Record<string, string> = {
    application: "com.apple.product-type.application",
    app_extension: "com.apple.product-type.app-extension",
    bundle: "com.apple.product-type.bundle",
    command_line_tool: "com.apple.product-type.tool",
    dynamic_library: "com.apple.product-type.library.dynamic",
    framework: "com.apple.product-type.framework",
    static_library: "com.apple.product-type.library.static",
    unit_test_bundle: "com.apple.product-type.bundle.unit-test",
    watch_app: "com.apple.product-type.application.watchapp",
    watch2_app: "com.apple.product-type.application.watchapp2",
    watch_extension: "com.apple.product-type.watchkit-extension",
    watch2_extension: "com.apple.product-type.watchkit2-extension",
    // Custom
    app_clip: "com.apple.product-type.application.on-demand-install-capable",
    app_extension_messages_sticker_pack:
      "com.apple.product-type.app-extension.messages-sticker-pack",
  };

  return PRODUCTTYPE_BY_TARGETTYPE[targetType];
}

function filetypeForProducttype(productType: string) {
  const FILETYPE_BY_PRODUCTTYPE: Record<string, string> = {
    "com.apple.product-type.application": '"wrapper.application"',
    "com.apple.product-type.app-extension": '"wrapper.app-extension"',
    "com.apple.product-type.bundle": '"wrapper.plug-in"',
    "com.apple.product-type.tool": '"compiled.mach-o.dylib"',
    "com.apple.product-type.library.dynamic": '"compiled.mach-o.dylib"',
    "com.apple.product-type.framework": '"wrapper.framework"',
    "com.apple.product-type.library.static": '"archive.ar"',
    "com.apple.product-type.bundle.unit-test": '"wrapper.cfbundle"',
    "com.apple.product-type.application.watchapp": '"wrapper.application"',
    "com.apple.product-type.application.watchapp2": '"wrapper.application"',
    "com.apple.product-type.watchkit-extension": '"wrapper.app-extension"',
    "com.apple.product-type.watchkit2-extension": '"wrapper.app-extension"',
    // Custom
    "com.apple.product-type.app-extension.messages-sticker-pack":
      '"wrapper.app-extension"',
    "com.apple.product-type.application.on-demand-install-capable":
      '"wrapper.application"',
  };

  return FILETYPE_BY_PRODUCTTYPE[productType];
}

function pbxBuildPhaseObj(file: PBXFile) {
  const obj = Object.create(null);

  obj.value = file.uuid;
  obj.comment = longComment(file);

  return obj;
}

function longComment(file: PBXFile) {
  return util.format("%s in %s", file.basename, file.group);
}

function quoted(str: string) {
  return util.format(`"%s"`, str);
}

export function unquote(value: string): string {
  // projects with numeric names will fail due to a bug in the xcode package.
  if (typeof value === "number") {
    value = String(value);
  }
  return value.match(/^"(.*)"$/)?.[1] ?? value;
}
