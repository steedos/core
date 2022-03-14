import clx from 'classnames';
import React from 'react';
import { observer } from 'mobx-react-lite';
import { KeybindingRegistry, useInjectable, localize, PrefixQuickOpenService } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';

import { QuickOpenHandlerRegistry } from '../../prefix-quick-open.service';
import { KeybindingView } from '../keybinding';

import styles from './style.module.less';

export const QuickOpenTabs = observer(() => {
  const keybindingRegistry = useInjectable<KeybindingRegistry>(KeybindingRegistry);
  const prefixQuickOpen = useInjectable<PrefixQuickOpenService>(PrefixQuickOpenService);
  const handlers = useInjectable<QuickOpenHandlerRegistry>(QuickOpenHandlerRegistry);

  const tabs = React.useMemo(() => handlers.getSortedTabs(), []);

  const onChange = React.useCallback((prefix: string) => {
    prefixQuickOpen.activePrefix = prefix;
    prefixQuickOpen.onChangeTab(prefix);
  }, []);

  const getKeybinding = React.useCallback((commandId: string) => {
    const bindings = keybindingRegistry.getKeybindingsForCommand(commandId);
    return bindings ? bindings[0] : undefined;
  }, [keybindingRegistry]);

  console.log('prefixQuickOpen.activePrefix>>>', prefixQuickOpen.activePrefix);
  return (
    <div className={styles.quickopen_tabs}>
      {tabs.map(({ title, prefix, commandId }) => {
        const keybinding = getKeybinding(commandId);
        return (
          <div
            key={prefix}
            className={styles.quickopen_tabs_item}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (prefix !== prefixQuickOpen.activePrefix) {
                console.log('change >>');
                onChange(prefix);
              }
            }}
          >
            <div className={clx(styles.quickopen_tabs_item_text, { [styles.selected]: prefixQuickOpen.activePrefix === prefix })}>
              {title}
            </div>
            {keybinding && (
              <KeybindingView keybinding={keybinding} className={styles.keybinding} keyClassName={styles.tab_key} />
            )}
          </div>
        );
      })}
      <div className={styles.quickopen_tabs_tip}>
        {localize('quickopen.tab.tip.prefix')}
        <span className={styles.tab_key}>Tab</span>
        {localize('quickopen.tab.tip.suffix')}
      </div>
    </div>
  );
});
