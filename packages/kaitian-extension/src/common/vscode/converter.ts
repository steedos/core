import { RenderLineNumbersType } from '@ali/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import type * as vscode from 'vscode';
import * as types from './ext-types';
import * as model from './model.api';
import { URI, ISelection, IRange, IMarkerData, IRelatedInformation, MarkerTag, MarkerSeverity, ProgressLocation as MainProgressLocation } from '@ali/ide-core-common';
import { EndOfLineSequence, IDecorationRenderOptions, IThemeDecorationRenderOptions, IContentDecorationRenderOptions, TrackedRangeStickiness } from '@ali/ide-editor/lib/common';
import { IEvaluatableExpression } from '@ali/ide-debug/lib/common/evaluatable-expression';
import { SymbolInformation, Range as R, Position as P, SymbolKind as S } from 'vscode-languageserver-types';
import { ExtensionDocumentDataManager } from './doc';
import { WorkspaceEditDto, ResourceTextEditDto, ResourceFileEditDto, ITextEdit } from './workspace';
import { ViewColumn } from './enums';
import { FileStat, FileType } from '@ali/ide-file-service';
import { isMarkdownString } from './models';

export function toPosition(position: model.Position): types.Position {
  return new types.Position(position.lineNumber - 1, position.column - 1);
}

export function fromPosition(position: types.Position): model.Position {
  return { lineNumber: position.line + 1, column: position.character + 1 };
}

export function fromRange(range: undefined): undefined;
export function fromRange(range: vscode.Range): model.Range;
export function fromRange(range: vscode.Range | undefined): model.Range | undefined {
  if (!range) {
    return undefined;
  }
  const { start, end } = range;
  return {
    startLineNumber: start.line + 1,
    startColumn: start.character + 1,
    endLineNumber: end.line + 1,
    endColumn: end.character + 1,
  };
}

export function toRange(range: model.Range): types.Range {
  const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
  return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
}

interface Codeblock {
  language: string;
  value: string;
}

// tslint:disable-next-line:no-any
function isCodeblock(thing: any): thing is Codeblock {
  return thing && typeof thing === 'object'
    && typeof (thing as Codeblock).language === 'string'
    && typeof (thing as Codeblock).value === 'string';
}

export function fromMarkdown(markup: vscode.MarkdownString | vscode.MarkedString): model.MarkdownString {
  if (isCodeblock(markup)) {
    const { language, value } = markup;
    return { value: '```' + language + '\n' + value + '\n```\n' };
  } else if (isMarkdownString(markup)) {
    return markup;
  } else if (typeof markup === 'string') {
    return { value: markup as string };
  } else {
    return { value: '' };
  }
}

export function fromManyMarkdown(markup: (vscode.MarkdownString | vscode.MarkedString)[]): model.MarkdownString[] {
  return markup.map(fromMarkdown);
}

export function fromHover(hover: vscode.Hover): model.Hover {
  return {
    range: hover.range && fromRange(hover.range),
    contents: fromManyMarkdown(hover.contents),
  } as model.Hover;
}

export function fromLanguageSelector(selector: vscode.DocumentSelector): model.LanguageSelector | undefined {
  if (!selector) {
    return undefined;
  } else if (Array.isArray(selector)) {
    return selector.map(fromLanguageSelector) as model.LanguageSelector;
  } else if (typeof selector === 'string') {
    return selector;
  } else {
    return {
      language: selector.language,
      scheme: selector.scheme,
      pattern: fromGlobPattern(selector.pattern!),
    } as model.LanguageFilter;
  }
}

export function fromGlobPattern(pattern: vscode.GlobPattern): string | model.RelativePattern {
  if (typeof pattern === 'string') {
    return pattern;
  }

  if (isRelativePattern(pattern)) {
    return new types.RelativePattern(pattern.base, pattern.pattern);
  }

  return pattern;
}

function isRelativePattern(obj: {}): obj is vscode.RelativePattern {
  const rp = obj as vscode.RelativePattern;
  return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
}

export function fromLocation(value: vscode.Location): model.Location {
  return {
    range: value.range && fromRange(value.range),
    uri: value.uri,
  };
}

export function toLocation(value: model.Location): types.Location {
  return new types.Location(value.uri, toRange(value.range));
}

export function fromTextEdit(edit: vscode.TextEdit): model.SingleEditOperation {
  return {
    text: edit.newText,
    range: fromRange(edit.range),
  } as model.SingleEditOperation;
}

export function fromDefinitionLink(definitionLink: vscode.DefinitionLink): model.DefinitionLink {
  return {
    uri: definitionLink.targetUri,
    range: fromRange(definitionLink.targetRange),
    origin: definitionLink.originSelectionRange ? fromRange(definitionLink.originSelectionRange) : undefined,
    selectionRange: definitionLink.targetSelectionRange ? fromRange(definitionLink.targetSelectionRange) : undefined,
  } as model.DefinitionLink;
}

export function fromInsertText(item: vscode.CompletionItem): string {
  if (typeof item.insertText === 'string') {
    return item.insertText;
  }
  if (typeof item.insertText === 'object') {
    return item.insertText.value;
  }
  return item.label;
}

export function fromFoldingRange(foldingRange: vscode.FoldingRange): model.FoldingRange {
  const range: model.FoldingRange = {
    start: foldingRange.start + 1,
    end: foldingRange.end + 1,
  };
  if (foldingRange.kind) {
    range.kind = fromFoldingRangeKind(foldingRange.kind);
  }
  return range;
}

export function fromFoldingRangeKind(kind: vscode.FoldingRangeKind | undefined): model.FoldingRangeKind | undefined {
  if (kind) {
    switch (kind) {
      case types.FoldingRangeKind.Comment:
        return model.FoldingRangeKind.Comment;
      case types.FoldingRangeKind.Imports:
        return model.FoldingRangeKind.Imports;
      case types.FoldingRangeKind.Region:
        return model.FoldingRangeKind.Region;
    }
  }
  return undefined;
}

export function fromSelectionRange(obj: vscode.SelectionRange): model.SelectionRange {
  return { range: fromRange(obj.range) };
}

export function fromColor(color: types.Color): [number, number, number, number] {
  return [color.red, color.green, color.blue, color.alpha];
}

export function toColor(color: [number, number, number, number]): types.Color {
  return new types.Color(color[0], color[1], color[2], color[3]);
}

export function fromColorPresentation(colorPresentation: vscode.ColorPresentation): model.ColorPresentation {
  return {
    label: colorPresentation.label,
    textEdit: colorPresentation.textEdit ? fromTextEdit(colorPresentation.textEdit) : undefined,
    additionalTextEdits: colorPresentation.additionalTextEdits ? colorPresentation.additionalTextEdits.map((value) => fromTextEdit(value)) : undefined,
  };
}

export function fromDocumentHighlightKind(kind?: vscode.DocumentHighlightKind): model.DocumentHighlightKind | undefined {
  switch (kind) {
    case types.DocumentHighlightKind.Text: return model.DocumentHighlightKind.Text;
    case types.DocumentHighlightKind.Read: return model.DocumentHighlightKind.Read;
    case types.DocumentHighlightKind.Write: return model.DocumentHighlightKind.Write;
  }
  return model.DocumentHighlightKind.Text;
}

export function fromDocumentHighlight(documentHighlight: vscode.DocumentHighlight): model.DocumentHighlight {
  return {
    range: fromRange(documentHighlight.range),
    kind: fromDocumentHighlightKind(documentHighlight.kind),
  } as model.DocumentHighlight;
}

export function convertDiagnosticToMarkerData(diagnostic: vscode.Diagnostic): IMarkerData {
  return {
    code: convertCode(diagnostic.code),
    severity: convertSeverity(diagnostic.severity),
    message: diagnostic.message,
    source: diagnostic.source,
    startLineNumber: diagnostic.range.start.line + 1,
    startColumn: diagnostic.range.start.character + 1,
    endLineNumber: diagnostic.range.end.line + 1,
    endColumn: diagnostic.range.end.character + 1,
    relatedInformation: convertRelatedInformation(diagnostic.relatedInformation),
    tags: convertTags(diagnostic.tags),
  };
}

function convertCode(code: string | number | undefined): string | undefined {
  if (typeof code === 'number') {
    return String(code);
  } else {
    return code;
  }
}

function convertSeverity(severity: types.DiagnosticSeverity): MarkerSeverity {
  switch (severity) {
    case types.DiagnosticSeverity.Error: return MarkerSeverity.Error;
    case types.DiagnosticSeverity.Warning: return MarkerSeverity.Warning;
    case types.DiagnosticSeverity.Information: return MarkerSeverity.Info;
    case types.DiagnosticSeverity.Hint: return MarkerSeverity.Hint;
  }
}

function convertRelatedInformation(diagnosticsRelatedInformation: vscode.DiagnosticRelatedInformation[] | undefined): IRelatedInformation[] | undefined {
  if (!diagnosticsRelatedInformation) {
    return undefined;
  }

  const relatedInformation: IRelatedInformation[] = [];
  for (const item of diagnosticsRelatedInformation) {
    relatedInformation.push({
      resource: item.location.uri.toString(),
      message: item.message,
      startLineNumber: item.location.range.start.line + 1,
      startColumn: item.location.range.start.character + 1,
      endLineNumber: item.location.range.end.line + 1,
      endColumn: item.location.range.end.character + 1,
    });
  }
  return relatedInformation;
}

function convertTags(tags: types.DiagnosticTag[] | undefined): MarkerTag[] | undefined {
  if (!tags) {
    return undefined;
  }

  const markerTags: MarkerTag[] = [];
  for (const tag of tags) {
    switch (tag) {
      case types.DiagnosticTag.Unnecessary: markerTags.push(MarkerTag.Unnecessary);
    }
  }
  return markerTags;
}

export function toSelection(selection: model.Selection): types.Selection {
  const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
  const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
  const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
  return new types.Selection(start, end);
}

export function fromSelection(selection: vscode.Selection): model.Selection {
  const { active, anchor } = selection;
  return {
    selectionStartLineNumber: anchor.line + 1,
    selectionStartColumn: anchor.character + 1,
    positionLineNumber: active.line + 1,
    positionColumn: active.character + 1,
  };
}

export function fromDocumentLink(link: vscode.DocumentLink): model.ILink {
  return {
    range: fromRange(link.range),
    url: link.target,
    tooltip: link.tooltip,
  };
}

export namespace TypeConverts {

  export namespace Selection {

    export function to(selection: ISelection): vscode.Selection {
      const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
      const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
      const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
      return new types.Selection(start, end);
    }

    export function from(selection: vscode.Selection): ISelection {
      const { anchor, active } = selection;
      return {
        selectionStartLineNumber: anchor.line + 1,
        selectionStartColumn: anchor.character + 1,
        positionLineNumber: active.line + 1,
        positionColumn: active.character + 1,
      };
    }
  }

  export namespace TextEditorLineNumbersStyle {
    export function from(style: types.TextEditorLineNumbersStyle): RenderLineNumbersType {
      switch (style) {
        case types.TextEditorLineNumbersStyle.Off:
          return RenderLineNumbersType.Off;
        case types.TextEditorLineNumbersStyle.Relative:
          return RenderLineNumbersType.Relative;
        case types.TextEditorLineNumbersStyle.On:
        default:
          return RenderLineNumbersType.On;
      }
    }
    export function to(style: RenderLineNumbersType): types.TextEditorLineNumbersStyle {
      switch (style) {
        case RenderLineNumbersType.Off:
          return types.TextEditorLineNumbersStyle.Off;
        case RenderLineNumbersType.Relative:
          return types.TextEditorLineNumbersStyle.Relative;
        case RenderLineNumbersType.On:
        default:
          return types.TextEditorLineNumbersStyle.On;
      }
    }
  }

  export namespace Range {

    export function from(range: undefined): undefined;
    export function from(range: vscode.Range): IRange;
    export function from(range: vscode.Range | undefined): IRange | undefined;
    export function from(range: vscode.Range | undefined): IRange | undefined {
      if (!range) {
        return undefined;
      }
      const { start, end } = range;
      return {
        startLineNumber: start.line + 1,
        startColumn: start.character + 1,
        endLineNumber: end.line + 1,
        endColumn: end.character + 1,
      };
    }

    // tslint:disable: unified-signatures
    export function to(range: undefined): types.Range;
    export function to(range: IRange): types.Range;
    // tslint:enable: unified-signatures
    export function to(range: IRange | undefined): types.Range | undefined;
    export function to(range: IRange | undefined): types.Range | undefined {
      if (!range) {
        return undefined;
      }
      const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
      return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
    }
  }

  export namespace EndOfLine {

    export function from(eol: types.EndOfLine): EndOfLineSequence | undefined {
      if (eol === types.EndOfLine.CRLF) {
        return EndOfLineSequence.CRLF;
      } else if (eol === types.EndOfLine.LF) {
        return EndOfLineSequence.LF;
      }
      return undefined;
    }

    export function to(eol: EndOfLineSequence): types.EndOfLine | undefined {
      if (eol === EndOfLineSequence.CRLF) {
        return types.EndOfLine.CRLF;
      } else if (eol === EndOfLineSequence.LF) {
        return types.EndOfLine.LF;
      }
      return undefined;
    }
  }
  export namespace DecorationRenderOptions {
    export function from(options: any): IDecorationRenderOptions {
      return {
        isWholeLine: options.isWholeLine,
        rangeBehavior: options.rangeBehavior ? DecorationRangeBehavior.from(options.rangeBehavior) : undefined,
        overviewRulerLane: options.overviewRulerLane,
        light: options.light ? ThemableDecorationRenderOptions.from(options.light) : undefined,
        dark: options.dark ? ThemableDecorationRenderOptions.from(options.dark) : undefined,

        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        outline: options.outline,
        outlineColor: options.outlineColor as string | types.ThemeColor,
        outlineStyle: options.outlineStyle,
        outlineWidth: options.outlineWidth,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        borderRadius: options.borderRadius,
        borderSpacing: options.borderSpacing,
        borderStyle: options.borderStyle,
        borderWidth: options.borderWidth,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        cursor: options.cursor,
        color: options.color as string | types.ThemeColor,
        opacity: options.opacity,
        letterSpacing: options.letterSpacing,
        gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
        gutterIconSize: options.gutterIconSize,
        overviewRulerColor: options.overviewRulerColor as string | types.ThemeColor,
        before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : undefined,
        after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : undefined,
      };
    }
  }
  export namespace ThemableDecorationRenderOptions {
    export function from(options: vscode.ThemableDecorationRenderOptions): IThemeDecorationRenderOptions {
      if (typeof options === 'undefined') {
        return options;
      }
      return {
        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        outline: options.outline,
        outlineColor: options.outlineColor as string | types.ThemeColor,
        outlineStyle: options.outlineStyle,
        outlineWidth: options.outlineWidth,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        borderRadius: options.borderRadius,
        borderSpacing: options.borderSpacing,
        borderStyle: options.borderStyle,
        borderWidth: options.borderWidth,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        cursor: options.cursor,
        color: options.color as string | types.ThemeColor,
        opacity: options.opacity,
        letterSpacing: options.letterSpacing,
        gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
        gutterIconSize: options.gutterIconSize,
        overviewRulerColor: options.overviewRulerColor as string | types.ThemeColor,
        before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : undefined,
        after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : undefined,
      };
    }
  }
  export namespace ThemableDecorationAttachmentRenderOptions {
    export function from(options: vscode.ThemableDecorationAttachmentRenderOptions): IContentDecorationRenderOptions {
      if (typeof options === 'undefined') {
        return options;
      }
      return {
        contentText: options.contentText,
        contentIconPath: options.contentIconPath ? pathOrURIToURI(options.contentIconPath) : undefined,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        color: options.color as string | types.ThemeColor,
        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        margin: options.margin,
        width: options.width,
        height: options.height,
      };
    }
  }

  export namespace DecorationRangeBehavior {
    export function from(value: types.DecorationRangeBehavior): TrackedRangeStickiness | undefined {
      if (typeof value === 'undefined') {
        return value;
      }
      switch (value) {
        case types.DecorationRangeBehavior.OpenOpen:
          return TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
        case types.DecorationRangeBehavior.ClosedClosed:
          return TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
        case types.DecorationRangeBehavior.OpenClosed:
          return TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
        case types.DecorationRangeBehavior.ClosedOpen:
          return TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
      }
    }
  }

  export namespace TextEdit {

    export function from(edit: vscode.TextEdit): ITextEdit {
      return {
        text: edit.newText,
        eol: EndOfLine.from(edit.newEol),
        range: fromRange(edit.range),
      } as ITextEdit;
    }
    export function to(edit: ITextEdit): types.TextEdit {
      const result = new types.TextEdit(toRange(edit.range), edit.text);
      result.newEol = (typeof edit.eol === 'undefined' ? undefined : EndOfLine.to(edit.eol))!;
      return result;
    }
  }

  export namespace WorkspaceEdit {
    export function from(value: vscode.WorkspaceEdit, documents?: ExtensionDocumentDataManager): model.WorkspaceEditDto {
      const result: model.WorkspaceEditDto = {
        edits: [],
      };
      for (const entry of (value as types.WorkspaceEdit).allEntries()) {
        if (entry._type === 1) {
          // file operation
          result.edits.push({
            oldUri: entry.from,
            newUri: entry.to,
            options: entry.options,
            // TODO: WorkspaceEdit metadata
            // metadata: entry.metadata
          } as model.ResourceFileEditDto);

        } else {
          // text edits
          const doc = documents?.getDocument(entry.uri);
          result.edits.push({
            resource: entry.uri,
            edit: TextEdit.from(entry.edit),
            modelVersionId: doc?.version,
            // TODO: WorkspaceEdit metadata
            // metadata: entry.metadata
          } as model.ResourceTextEditDto);
        }
      }
      return result;
    }

    export function to(value: WorkspaceEditDto) {
      const result = new types.WorkspaceEdit();
      for (const edit of value.edits) {
        if ((edit as ResourceTextEditDto).edit) {
          result.replace(
            URI.revive((edit as ResourceTextEditDto).resource),
            Range.to((edit as ResourceTextEditDto).edit.range),
            (edit as ResourceTextEditDto).edit.text,
          );
        } else {
          result.renameFile(
            URI.revive((edit as ResourceFileEditDto).oldUri!),
            URI.revive((edit as ResourceFileEditDto).newUri!),
            (edit as ResourceFileEditDto).options,
          );
        }
      }
      return result;
    }
  }

  export namespace GlobPattern {
    export function from(pattern: vscode.GlobPattern): string | types.RelativePattern;
    export function from(pattern: undefined): undefined;
    export function from(pattern: null): null;
    export function from(
      pattern: vscode.GlobPattern | undefined | null,
    ): string | types.RelativePattern | undefined | null;
    export function from(
      pattern: vscode.GlobPattern | undefined | null,
    ): string | types.RelativePattern | undefined | null {
      if (pattern instanceof types.RelativePattern) {
        return pattern;
      }

      if (typeof pattern === 'string') {
        return pattern;
      }

      if (isRelativePattern(pattern)) {
        return new types.RelativePattern(pattern.base, pattern.pattern);
      }

      return pattern; // preserve `undefined` and `null`
    }

    function isRelativePattern(obj: any): obj is vscode.RelativePattern {
      const rp = obj as vscode.RelativePattern;
      return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
    }
  }
}

export function pathOrURIToURI(value: string | types.Uri): types.Uri {
  if (typeof value === 'undefined') {
    return value;
  }
  if (typeof value === 'string') {
    return types.Uri.file(value);
  } else {
    return value;
  }
}

export namespace SymbolKind {
  // tslint:disable-next-line:no-null-keyword
  const fromMapping: { [kind: number]: types.SymbolKind } = Object.create(null);
  fromMapping[types.SymbolKind.File] = types.SymbolKind.File;
  fromMapping[types.SymbolKind.Module] = types.SymbolKind.Module;
  fromMapping[types.SymbolKind.Namespace] = types.SymbolKind.Namespace;
  fromMapping[types.SymbolKind.Package] = types.SymbolKind.Package;
  fromMapping[types.SymbolKind.Class] = types.SymbolKind.Class;
  fromMapping[types.SymbolKind.Method] = types.SymbolKind.Method;
  fromMapping[types.SymbolKind.Property] = types.SymbolKind.Property;
  fromMapping[types.SymbolKind.Field] = types.SymbolKind.Field;
  fromMapping[types.SymbolKind.Constructor] = types.SymbolKind.Constructor;
  fromMapping[types.SymbolKind.Enum] = types.SymbolKind.Enum;
  fromMapping[types.SymbolKind.Interface] = types.SymbolKind.Interface;
  fromMapping[types.SymbolKind.Function] = types.SymbolKind.Function;
  fromMapping[types.SymbolKind.Variable] = types.SymbolKind.Variable;
  fromMapping[types.SymbolKind.Constant] = types.SymbolKind.Constant;
  fromMapping[types.SymbolKind.String] = types.SymbolKind.String;
  fromMapping[types.SymbolKind.Number] = types.SymbolKind.Number;
  fromMapping[types.SymbolKind.Boolean] = types.SymbolKind.Boolean;
  fromMapping[types.SymbolKind.Array] = types.SymbolKind.Array;
  fromMapping[types.SymbolKind.Object] = types.SymbolKind.Object;
  fromMapping[types.SymbolKind.Key] = types.SymbolKind.Key;
  fromMapping[types.SymbolKind.Null] = types.SymbolKind.Null;
  fromMapping[types.SymbolKind.EnumMember] = types.SymbolKind.EnumMember;
  fromMapping[types.SymbolKind.Struct] = types.SymbolKind.Struct;
  fromMapping[types.SymbolKind.Event] = types.SymbolKind.Event;
  fromMapping[types.SymbolKind.Operator] = types.SymbolKind.Operator;
  fromMapping[types.SymbolKind.TypeParameter] = types.SymbolKind.TypeParameter;

  export function fromSymbolKind(kind: vscode.SymbolKind): types.SymbolKind {
    return fromMapping[kind] || types.SymbolKind.Property;
  }

  export function toSymbolKind(kind: types.SymbolKind): vscode.SymbolKind {
    for (const k in fromMapping) {
      if (fromMapping[k] === kind) {
        return Number(k);
      }
    }
    return types.SymbolKind.Property;
  }
}
export function fromDocumentSymbol(info: vscode.DocumentSymbol): model.DocumentSymbol {
  const result: model.DocumentSymbol = {
    name: info.name,
    detail: info.detail,
    range: fromRange(info.range)!,
    selectionRange: fromRange(info.selectionRange)!,
    kind: SymbolKind.fromSymbolKind(info.kind),
    tags: info.tags?.map(SymbolTag.from) ?? [],
  };
  if (info.children) {
    result.children = info.children.map(fromDocumentSymbol);
  }
  return result;
}

export function fromSymbolInformation(symbolInformation: vscode.SymbolInformation): SymbolInformation | undefined {
  if (!symbolInformation) {
    return undefined;
  }

  if (symbolInformation.location && symbolInformation.location.range) {
    const p1 = P.create(symbolInformation.location.range.start.line, symbolInformation.location.range.start.character);
    const p2 = P.create(symbolInformation.location.range.end.line, symbolInformation.location.range.end.character);
    return SymbolInformation.create(symbolInformation.name, symbolInformation.kind++ as S, R.create(p1, p2),
      symbolInformation.location.uri.toString(), symbolInformation.containerName);
  }

  return {
    name: symbolInformation.name,
    containerName: symbolInformation.containerName,
    kind: symbolInformation.kind++ as S,
    location: {
      uri: symbolInformation.location.uri.toString(),
    },
  } as SymbolInformation;
}

export function toSymbolInformation(symbolInformation: SymbolInformation): vscode.SymbolInformation | undefined {
  if (!symbolInformation) {
    return undefined;
  }

  return {
    name: symbolInformation.name,
    containerName: symbolInformation.containerName,
    kind: symbolInformation.kind,
    location: {
      // TODO URI.create 是否等价
      uri: URI.revive(symbolInformation.location.uri),
      range: symbolInformation.location.range,
    },
  } as vscode.SymbolInformation;
}

export namespace SymbolTag {

  export function from(kind: types.SymbolTag): model.SymbolTag {
    switch (kind) {
      case types.SymbolTag.Deprecated: return model.SymbolTag.Deprecated;
    }
  }

  export function to(kind: model.SymbolTag): types.SymbolTag {
    switch (kind) {
      case model.SymbolTag.Deprecated: return types.SymbolTag.Deprecated;
    }
  }
}

export function fromCompletionItemKind(kind: vscode.CompletionItemKind | undefined): model.CompletionItemKind {
  switch (kind) {
    case types.CompletionItemKind.Method: return model.CompletionItemKind.Method;
    case types.CompletionItemKind.Function: return model.CompletionItemKind.Function;
    case types.CompletionItemKind.Constructor: return model.CompletionItemKind.Constructor;
    case types.CompletionItemKind.Field: return model.CompletionItemKind.Field;
    case types.CompletionItemKind.Variable: return model.CompletionItemKind.Variable;
    case types.CompletionItemKind.Class: return model.CompletionItemKind.Class;
    case types.CompletionItemKind.Interface: return model.CompletionItemKind.Interface;
    case types.CompletionItemKind.Struct: return model.CompletionItemKind.Struct;
    case types.CompletionItemKind.Module: return model.CompletionItemKind.Module;
    case types.CompletionItemKind.Property: return model.CompletionItemKind.Property;
    case types.CompletionItemKind.Unit: return model.CompletionItemKind.Unit;
    case types.CompletionItemKind.Value: return model.CompletionItemKind.Value;
    case types.CompletionItemKind.Constant: return model.CompletionItemKind.Constant;
    case types.CompletionItemKind.Enum: return model.CompletionItemKind.Enum;
    case types.CompletionItemKind.EnumMember: return model.CompletionItemKind.EnumMember;
    case types.CompletionItemKind.Keyword: return model.CompletionItemKind.Keyword;
    case types.CompletionItemKind.Snippet: return model.CompletionItemKind.Snippet;
    case types.CompletionItemKind.Text: return model.CompletionItemKind.Text;
    case types.CompletionItemKind.Color: return model.CompletionItemKind.Color;
    case types.CompletionItemKind.File: return model.CompletionItemKind.File;
    case types.CompletionItemKind.Reference: return model.CompletionItemKind.Reference;
    case types.CompletionItemKind.Folder: return model.CompletionItemKind.Folder;
    case types.CompletionItemKind.Event: return model.CompletionItemKind.Event;
    case types.CompletionItemKind.Operator: return model.CompletionItemKind.Operator;
    case types.CompletionItemKind.TypeParameter: return model.CompletionItemKind.TypeParameter;
  }
  return model.CompletionItemKind.Property;
}

export function toCompletionItemKind(kind: model.CompletionItemKind): types.CompletionItemKind {
  switch (kind) {
    case model.CompletionItemKind.Method: return types.CompletionItemKind.Method;
    case model.CompletionItemKind.Function: return types.CompletionItemKind.Function;
    case model.CompletionItemKind.Constructor: return types.CompletionItemKind.Constructor;
    case model.CompletionItemKind.Field: return types.CompletionItemKind.Field;
    case model.CompletionItemKind.Variable: return types.CompletionItemKind.Variable;
    case model.CompletionItemKind.Class: return types.CompletionItemKind.Class;
    case model.CompletionItemKind.Interface: return types.CompletionItemKind.Interface;
    case model.CompletionItemKind.Struct: return types.CompletionItemKind.Struct;
    case model.CompletionItemKind.Module: return types.CompletionItemKind.Module;
    case model.CompletionItemKind.Property: return types.CompletionItemKind.Property;
    case model.CompletionItemKind.Unit: return types.CompletionItemKind.Unit;
    case model.CompletionItemKind.Value: return types.CompletionItemKind.Value;
    case model.CompletionItemKind.Constant: return types.CompletionItemKind.Constant;
    case model.CompletionItemKind.Enum: return types.CompletionItemKind.Enum;
    case model.CompletionItemKind.EnumMember: return types.CompletionItemKind.EnumMember;
    case model.CompletionItemKind.Keyword: return types.CompletionItemKind.Keyword;
    case model.CompletionItemKind.Snippet: return types.CompletionItemKind.Snippet;
    case model.CompletionItemKind.Text: return types.CompletionItemKind.Text;
    case model.CompletionItemKind.Color: return types.CompletionItemKind.Color;
    case model.CompletionItemKind.File: return types.CompletionItemKind.File;
    case model.CompletionItemKind.Reference: return types.CompletionItemKind.Reference;
    case model.CompletionItemKind.Folder: return types.CompletionItemKind.Folder;
    case model.CompletionItemKind.Event: return types.CompletionItemKind.Event;
    case model.CompletionItemKind.Operator: return types.CompletionItemKind.Operator;
    case model.CompletionItemKind.TypeParameter: return types.CompletionItemKind.TypeParameter;
  }
  return types.CompletionItemKind.Property;
}

export namespace CompletionItemTag {

  export function from(kind: types.CompletionItemTag): model.CompletionItemTag {
    switch (kind) {
      case types.CompletionItemTag.Deprecated: return model.CompletionItemTag.Deprecated;
    }
  }

  export function to(kind: model.CompletionItemTag): types.CompletionItemTag {
    switch (kind) {
      case model.CompletionItemTag.Deprecated: return types.CompletionItemTag.Deprecated;
    }
  }
}

export function viewColumnToResourceOpenOptions(viewColumn?: ViewColumn): { groupIndex?: number, relativeGroupIndex?: number } {
  const result: { groupIndex?: number, relativeGroupIndex?: number } = {};
  if (viewColumn) {
    if (viewColumn === ViewColumn.Beside) {
      result.relativeGroupIndex = 1;
    } else if (viewColumn === ViewColumn.Active) {
      result.relativeGroupIndex = 0;
    } else {
      result.groupIndex = viewColumn - 1;
    }
  }
  return result;
}

export namespace ProgressLocation {
  export function from(loc: vscode.ProgressLocation | { viewId: string }): MainProgressLocation | string {
    if (typeof loc === 'object') {
      return loc.viewId;
    }

    switch (loc) {
      case types.ProgressLocation.SourceControl: return MainProgressLocation.Scm;
      case types.ProgressLocation.Window: return MainProgressLocation.Window;
      case types.ProgressLocation.Notification: return MainProgressLocation.Notification;
    }
    throw new Error(`Unknown 'ProgressLocation'`);
  }
}

// FIXME: 不完备，fileService.FileStat信息会更多
export function fromFileStat(stat: vscode.FileStat, uri: types.Uri) {
  const isSymbolicLink = stat.type.valueOf() === FileType.SymbolicLink.valueOf();
  const isDirectory = stat.type.valueOf() === FileType.Directory.valueOf();

  const result: FileStat = {
    uri: uri.toString(),
    lastModification: stat.mtime,
    createTime: stat.ctime,
    isSymbolicLink,
    isDirectory,
    size: stat.size,
  };

  return result;
}

export function toFileStat(stat: FileStat): vscode.FileStat {
  return {
    ctime: stat.createTime || 0,
    mtime: stat.lastModification,
    size: stat.size || 0,
    type: stat.type || FileType.Unknown,
  };
}

export function isLikelyVscodeRange(thing: any): thing is types.Range {
  if (!thing) {
    return false;
  }
  return (thing as types.Range).start !== undefined && (thing as types.Range).end !== undefined;
}

export namespace EvaluatableExpression {
  export function from(expression: vscode.EvaluatableExpression): IEvaluatableExpression {
    return {
      range: fromRange(expression.range),
      expression: expression.expression,
    } as IEvaluatableExpression;
  }

  export function to(info: IEvaluatableExpression): types.EvaluatableExpression {
    return new types.EvaluatableExpression(toRange(info.range), info.expression);
  }
}
