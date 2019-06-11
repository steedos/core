import { Injectable } from '@ali/common-di';
import { URI, Event } from '@ali/ide-core-common';
import { IResource } from './resource';
import { DocumentModel } from '@ali/ide-doc-model';
import { IRange } from '@ali/ide-doc-model/lib/common/doc';

export interface IEditor {

  /**
   * editor的UID
   */
  uid: string;

  /**
   * editor中打开的documentModel
   */
  currentDocumentModel: DocumentModel;

  layout(): void;

  open(uri: URI): Promise<void>;

  /**
   * 拿到原始的editor实例
   */
  editor: monaco.editor.IStandaloneCodeEditor;

}

@Injectable()
export abstract class EditorCollectionService {
  public abstract async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor>;
}

export interface IEditorGroup {

  name: string;

  codeEditor: IEditor;

  resources: IResource[];

  open(uri: URI): Promise<void>;

  close(uri: URI): Promise<void>;

}

export abstract class WorkbenchEditorService {
  onEditorOpenChange: Event<URI>;

  // TODO
  editorGroups: IEditorGroup[];

  currentEditor: IEditor | undefined;

  abstract async open(uri: URI): Promise<void>;
}

export interface IResourceOpenOptions {
  range?: IRange;
  index?: number;
}
