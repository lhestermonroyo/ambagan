import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> & VariantProps<typeof textStyle>;

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    // Determine the correct Google Sans font variant for web
    let fontFamily = 'GoogleSans-Regular, sans-serif';
    if (bold && italic) fontFamily = 'GoogleSans-BoldItalic, sans-serif';
    else if (bold) fontFamily = 'GoogleSans-Bold, sans-serif';
    else if (italic) fontFamily = 'GoogleSans-Italic, sans-serif';

    return (
      <span
        style={{
          ...props.style,
          fontFamily
        }}
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className
        })}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
