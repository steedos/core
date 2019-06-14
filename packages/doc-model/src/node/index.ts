import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { documentService } from '../common';
import { NodeDocumentService } from './provider';

@Injectable()
export class DocModelModule extends NodeModule {
  providers = [];
  backServices = [
    {
      servicePath: documentService,
      token: NodeDocumentService,
    },
  ];
}
