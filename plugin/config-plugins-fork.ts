import { IOSConfig } from "@expo/config-plugins";

const { addFileToGroupAndLink } = IOSConfig.XcodeUtils;
type XcodeProject = any;

/**
 * Add a resource file (ex: `SplashScreen.storyboard`, `Images.xcassets`) to an Xcode project.
 * This is akin to creating a new code file in Xcode with `⌘+n`.
 */
export function addResourceFileToGroup({
  filepath,
  groupName,
  // Should add to `PBXBuildFile Section`
  isBuildFile,
  project,
  verbose,
  targetUuid,
}: {
  filepath: string;
  groupName: string;
  isBuildFile?: boolean;
  project: XcodeProject;
  verbose?: boolean;
  targetUuid?: string;
}): XcodeProject {
  return addFileToGroupAndLink({
    filepath,
    groupName,
    project,
    verbose,
    targetUuid,
    addFileToProject({ project, file }) {
      project.addToPbxFileReferenceSection(file);
      if (isBuildFile) {
        project.addToPbxBuildFileSection(file);
      }
      project.addToPbxResourcesBuildPhase(file);
    },
  });
}

/**
 * Add a build source file (ex: `AppDelegate.m`, `ViewController.swift`) to an Xcode project.
 * This is akin to creating a new code file in Xcode with `⌘+n`.
 */
export function addBuildSourceFileToGroup({
  filepath,
  groupName,
  project,
  verbose,
  targetUuid,
}: {
  filepath: string;
  groupName: string;
  project: XcodeProject;
  verbose?: boolean;
  targetUuid?: string;
}): XcodeProject {
  return addFileToGroupAndLink({
    filepath,
    groupName,
    project,
    verbose,
    targetUuid,
    addFileToProject({ project, file }) {
      project.addToPbxFileReferenceSection(file);
      project.addToPbxBuildFileSection(file);
      project.addToPbxSourcesBuildPhase(file);
    },
  });
}
